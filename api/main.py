'''
Created by: Akash Saranathan
Created on: 04/09/2026
Modified on: 05/12/2026
Purpose: FastAPI app — multimodal agent, SQLite chat sessions, RAG kb uploads, static SPA.
How to run: uvicorn api.main:app --reload
'''
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()
import os
import re
import uuid
import warnings

warnings.filterwarnings("ignore")

import shutil
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from agent.rag_service import _list_kb_doc_paths

from nemoguardrails import LLMRails, RailsConfig

from agent.agent import get_agent, KB_RAG_EXTENSIONS, invalidate_kb_index_cache
from api.chat_sessions import router as sessions_router
from api.guardrails import (
    advanced_output_safety,
    check_input_safety,
    check_output_safety,
)
from api import sqlite_store
from ml.inference import predict_image
from nemo_guard import action_safety_router

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")

client = OpenAI()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)

app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

UPLOAD_DIR = "temp"
KB_DIR = Path(__file__).resolve().parent.parent / "kb"
os.makedirs(UPLOAD_DIR, exist_ok=True)

IMAGE_UPLOAD_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff",
})

# Last image path per chat session (not persisted; paths are temp files)
SESSION_LAST_IMAGE: dict[str, str] = {}

#agent = get_agent()
conversations = {}

MAX_HISTORY = 6
USE_FULL_NEMO = False


@app.post("/predict-image")
async def predict(file: UploadFile = File(None)):
    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    prediction = predict_image(file_path)
    return {"filename": file.filename, "prediction": prediction}


@app.post("/chat")
async def chat(prompt: str, session_id: str = None):
    if session_id is None:
        session_id = str(uuid.uuid4())
        conversations[session_id] = []
    history = conversations.get(session_id, [])
    if not history:
        history.append(
            {"role": "system", "content": "You are a helpful assistant. Keep answers under 3 sentences."}
        )
    history.append({"role": "user", "content": prompt})
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=history,
        max_tokens=500,
    )
    reply = response.choices[0].message.content
    history.append({"role": "assistant", "content": reply})
    conversations[session_id] = history
    return {"session_id": session_id, "response": reply}


@app.post("/agent")
async def run_agent(query: str):
    result = agent.run(query)
    return {"response": result}

# trial

@app.post("/multimodal-agent")
async def multimodal_agent(
    query: str = Form(...),
    session_id: str = Form(...),
    file: UploadFile = File(None),
):

    is_safe, safety_msg = check_input_safety(query)
    if not is_safe:
        return {"response": safety_msg}

    sqlite_store.ensure_session(session_id)

    image_analysis_text = ""
    saved_file_path = None
    attachment_name = None

    if file and file.filename:
        try:
            content = await file.read()

            if content:
                ext = Path(file.filename).suffix.lower()
                attachment_name = Path(file.filename).name

                # =========================
                # KNOWLEDGE BASE FILES
                # =========================
                if ext in KB_RAG_EXTENSIONS:

                    KB_DIR.mkdir(parents=True, exist_ok=True)

                    orig_name = Path(file.filename).name

                    stem = "".join(
                        c for c in Path(orig_name).stem
                        if c.isalnum() or c in " -_"
                    ).strip()[:120] or "document"

                    dest = KB_DIR / f"{stem}{ext}"

                    if dest.exists():
                        dest = KB_DIR / f"{stem}_{uuid.uuid4().hex[:6]}{ext}"

                    dest.write_bytes(content)

                    # Invalidate FAISS cache
                    invalidate_kb_index_cache()

                    image_analysis_text = (
                        "\n[System Note: User uploaded a document to the knowledge base. "
                        "You MUST use search_knowledge_base before answering questions "
                        "about this document.]"
                    )

                # =========================
                # IMAGE FILES
                # =========================
                elif ext in IMAGE_UPLOAD_EXTENSIONS:

                    unique_name = f"{uuid.uuid4()}{ext}"

                    file_path = os.path.join(
                        UPLOAD_DIR,
                        unique_name
                    )

                    with open(file_path, "wb") as buffer:
                        buffer.write(content)

                    saved_file_path = file_path

                    SESSION_LAST_IMAGE[session_id] = saved_file_path

                    prediction = predict_image(file_path)

                    image_analysis_text = (
                        f"\n[System Note: User uploaded an image. "
                        f"Image Analysis: {prediction}]"
                    )

                # =========================
                # UNSUPPORTED
                # =========================
                else:
                    image_analysis_text = (
                        "\n[System Note: Unsupported file type. "
                        "Attach an image (png, jpg, webp, etc.) "
                        "or a knowledge-base file "
                        "(pdf, txt, md, docx, csv, json, html).]"
                    )

        except Exception as e:
            print(f"Critical File Error: {e}")

            image_analysis_text = (
                "\n[System Note: User uploaded a file, "
                "but it could not be processed.]"
            )

        finally:
            await file.close()

    # ==========================================
    # LOAD CHAT HISTORY
    # ==========================================
    prior = sqlite_store.get_messages(session_id)

    history_text = ""

    for m in prior[-MAX_HISTORY:]:

        role = m["role"]

        label = "User" if role == "user" else "Assistant"

        history_text += f"{label}: {m['content']}\n"

    # ==========================================
    # KB DETECTION
    # ==========================================
    kb_has_files = bool(_list_kb_doc_paths())

    kb_instruction = (
        "\nIMPORTANT: The user has uploaded documents "
        "in the knowledge base. "
        "You MUST call search_knowledge_base before answering "
        "any factual, technical, or document-related question. "
        "Do NOT answer from memory alone. "
        "Always retrieve relevant passages first."
        if kb_has_files
        else ""
    )

    # ==========================================
    # FINAL PROMPT
    # ==========================================
    full_prompt = f"""
Conversation History:
{history_text}

Current User Query:
{query}

{image_analysis_text}

{kb_instruction}


Instructions:

- Give clear and concise answers.
- When an image was uploaded, use classify_image when relevant.
- Use information retrieved from the knowledge base when available.
- Mention source filenames only when useful or explicitly requested.
- Never hallucinate document contents.
"""

    final_response = ""

    active_image_path = (
        saved_file_path
        or SESSION_LAST_IMAGE.get(session_id)
    )

    # ==========================================
    # FULL NEMO MODE
    # ==========================================
    if USE_FULL_NEMO:

        try:
            config = RailsConfig.from_path("./config")

            rails_inst = LLMRails(config)

            res = await rails_inst.generate_async(
                messages=[
                    {
                        "role": "user",
                        "content": full_prompt,
                    }
                ],
                options={
                    "output_vars": True,
                    "llm_params": {
                        "max_tokens": 2048
                    },
                },
                context={
                    "last_image_path": active_image_path
                },
            )

            final_response = res.get(
                "content",
                "I'm sorry, I couldn't generate a response."
            )

        except Exception as e:

            print(f"NeMo Error: {e}")

            final_response = (
                "Error in safety rails processing."
            )

    # ==========================================
    # NORMAL AGENT MODE
    # ==========================================
    else:

        decision = await action_safety_router(
            {
                "last_user_message": query
            }
        )

        if decision == "block":
            return {
                "response": "🚫 Request blocked due to safety policy."
            }

        try:

            # IMPORTANT:
            # Create fresh agent per request
            ag = get_agent()

            if active_image_path:

                agent_input = (
                    f"{full_prompt}\n\n"
                    f"IMAGE_LOCATION: {active_image_path}\n"
                    f"INSTRUCTION: "
                    f"If the user asks about the image, "
                    f"use the classify_image tool "
                    f"with the IMAGE_LOCATION provided above."
                )

            else:
                agent_input = full_prompt

            # final_response = ag.run(agent_input)
            response = ag.invoke(
                {
                    "input": agent_input
                }
            )

            final_response = response["output"]

        except Exception as e:

            print(f"Agent Execution Error: {e}")

            final_response = (
                "I encountered an error while analyzing your request."
            )

    # ==========================================
    # OUTPUT SAFETY
    # ==========================================
    final_response = advanced_output_safety(final_response)

    final_response = check_output_safety(final_response)

    # ==========================================
    # STORE CHAT
    # ==========================================
    sqlite_store.append_message(
        session_id,
        "user",
        query,
        attachment_name
    )

    sqlite_store.append_message(
        session_id,
        "assistant",
        final_response,
        None
    )

    # ==========================================
    # SET TITLE
    # ==========================================
    if not prior:

        sqlite_store.set_session_title(
            session_id,
            (
                query.strip()[:80] + "…"
            )
            if len(query.strip()) > 80
            else query.strip() or "New chat",
        )

    # ==========================================
    # CLEAN RESPONSE
    # ==========================================
    clean_response = re.sub(
        r"[*`_]",
        "",
        final_response
    )

    return {
        "response": clean_response
    }

# working code
# @app.post("/multimodal-agent")
# async def multimodal_agent(
#     query: str = Form(...),
#     session_id: str = Form(...),
#     file: UploadFile = File(None),
# ):
#     is_safe, safety_msg = check_input_safety(query)
#     if not is_safe:
#         return {"response": safety_msg}

#     sqlite_store.ensure_session(session_id)

#     image_analysis_text = ""
#     saved_file_path = None
#     attachment_name = None
#     if file and file.filename:
#         try:
#             content = await file.read()
#             if content:
#                 ext = Path(file.filename).suffix.lower()
#                 attachment_name = Path(file.filename).name
#                 if ext in KB_RAG_EXTENSIONS:
#                     KB_DIR.mkdir(parents=True, exist_ok=True)
#                     orig_name = Path(file.filename).name
#                     stem = "".join(
#                         c for c in Path(orig_name).stem if c.isalnum() or c in " -_"
#                     ).strip()[:120] or "document"
#                     dest = KB_DIR / f"{stem}{ext}"
#                     if dest.exists():
#                         dest = KB_DIR / f"{stem}_{uuid.uuid4().hex[:6]}{ext}"
#                     dest.write_bytes(content)
#                     invalidate_kb_index_cache()
#                     image_analysis_text = (
#                         "\n[System Note: User uploaded a document to the knowledge base. "
#                         "Use search_knowledge_base with the user's question to retrieve "
#                         "relevant passages before answering.]"
#                     )
#                 elif ext in IMAGE_UPLOAD_EXTENSIONS:
#                     unique_name = f"{uuid.uuid4()}{ext}"
#                     file_path = os.path.join(UPLOAD_DIR, unique_name)
#                     with open(file_path, "wb") as buffer:
#                         buffer.write(content)
#                     saved_file_path = file_path
#                     SESSION_LAST_IMAGE[session_id] = saved_file_path
#                     prediction = predict_image(file_path)
#                     image_analysis_text = (
#                         f"\n[System Note: User uploaded an image. Image Analysis: {prediction}]"
#                     )
#                 else:
#                     image_analysis_text = (
#                         "\n[System Note: Unsupported file type. Attach an image "
#                         "(png, jpg, webp, …) or a knowledge-base file "
#                         "(pdf, txt, md, docx, csv, json, html).]"
#                     )
#         except Exception as e:
#             print(f"Critical File Error: {e}")
#             image_analysis_text = (
#                 "\n[System Note: User uploaded a file, but it could not be processed.]"
#             )
#         finally:
#             await file.close()

#     prior = sqlite_store.get_messages(session_id)
#     history_text = ""
#     for m in prior[-MAX_HISTORY:]:
#         role = m["role"]
#         label = "User" if role == "user" else "Assistant"
#         history_text += f"{label}: {m['content']}\n"

#     full_prompt = f"""
# Conversation History:
# {history_text}

# Current User Query: {query}
# {image_analysis_text}

# Instructions: Give clear answers. When an image was uploaded, use classify_image when relevant.
# When knowledge base search is used, the tool returns CITATIONS — answer using inline references like [S1], [S2] and mention filename and page when provided.
# """

#     final_response = ""
#     active_image_path = saved_file_path or SESSION_LAST_IMAGE.get(session_id)

#     if USE_FULL_NEMO:
#         try:
#             config = RailsConfig.from_path("./config")
#             rails_inst = LLMRails(config)
#             res = await rails_inst.generate_async(
#                 messages=[{"role": "user", "content": full_prompt}],
#                 options={
#                     "output_vars": True,
#                     "llm_params": {"max_tokens": 2048},
#                 },
#                 context={"last_image_path": active_image_path},
#             )
#             final_response = res.get("content", "I'm sorry, I couldn't generate a response.")
#         except Exception as e:
#             print(f"NeMo Error: {e}")
#             final_response = "Error in safety rails processing."
#     else:
#         decision = await action_safety_router({"last_user_message": query})
#         if decision == "block":
#             return {"response": "🚫 Request blocked due to safety policy."}

#         try:
#             ag = agent
#             if active_image_path:
#                 agent_input = (
#                     f"{full_prompt}\n"
#                     f"IMAGE_LOCATION: {active_image_path}\n"
#                     f"INSTRUCTION: If the user asks about the image, use the classify_image tool with the IMAGE_LOCATION provided above."
#                 )
#             else:
#                 agent_input = full_prompt
#             final_response = ag.run(agent_input)
#         except Exception as e:
#             print(f"Agent Execution Error: {e}")
#             final_response = "I encountered an error while analyzing your request."

#     final_response = advanced_output_safety(final_response)
#     final_response = check_output_safety(final_response)

#     sqlite_store.append_message(session_id, "user", query, attachment_name)
#     sqlite_store.append_message(session_id, "assistant", final_response, None)

#     if not prior:
#         sqlite_store.set_session_title(
#             session_id,
#             (query.strip()[:80] + "…") if len(query.strip()) > 80 else query.strip() or "New chat",
#         )

#     clean_response = re.sub(r"[*`_]", "", final_response)
#     return {"response": clean_response}


# @app.get("/")
# async def serve_react_root():
#     return FileResponse("frontend/dist/index.html")


# @app.get("/{full_path:path}")
# async def serve_spa_or_asset(full_path: str):
#     if full_path.startswith("api/"):
#         from fastapi import HTTPException
#         raise HTTPException(status_code=404, detail="Not found")
#     file_path = f"frontend/dist/{full_path}"
#     if os.path.exists(file_path):
#         return FileResponse(file_path)
#     return FileResponse("frontend/dist/index.html")
