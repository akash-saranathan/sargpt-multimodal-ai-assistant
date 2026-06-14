# 

"""
Agent entrypoint: LangChain conversational agent with vision + production RAG.
RAG implementation lives in agent.rag_service (FAISS, OCR PDFs, SQLite dedupe, citations).
"""

from langchain.agents import initialize_agent, AgentType
from langchain.memory import ConversationBufferMemory
from langchain.tools import Tool
from langchain_openai import ChatOpenAI

from agent.rag_service import (
    KB_RAG_EXTENSIONS,
    invalidate_kb_index_cache,
    search_knowledge_base_func,
)

from ml.inference import predict_image


def classify_image_func(image_path: str) -> str:
    image_path = image_path.strip().strip('"').strip("'")
    result = predict_image(image_path)
    return f"The image contains: {result}"


def get_agent():

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0,
        max_tokens=2048,
    )

    tools = [
        Tool(
            name="classify_image",
            func=classify_image_func,
            description=(
                "Use this tool to analyze an image file. "
                "Input must be the absolute file path to the image. "
                "Always use this tool when you see IMAGE_LOCATION."
            ),
        ),

        Tool(
            name="search_knowledge_base",
            func=search_knowledge_base_func,
            description=(
        "ALWAYS use this tool to answer questions about uploaded documents. "
        "Search the user's knowledge base (PDF, Word, text, CSV, JSON, HTML, etc.). "
        "Input should be the user's exact question or important keywords. "
        "Use the retrieved content to answer accurately. "
        "Never answer document-related questions from memory alone."
    ),

            # description=(
            #     "ALWAYS use this tool to answer questions about uploaded documents. "
            #     "Search the user's knowledge base (PDF, Word, text, CSV, JSON, HTML, etc.). "
            #     "Input should be the user's exact question or important keywords. "
            #     "Results include citations like [S1], [S2] with filename and page number. "
            #     "You MUST use those citations in the final answer. "
            #     "Never answer document-related questions from memory alone."
            # ),
        ),
    ]

    return initialize_agent(
        tools=tools,
        llm=llm,
        agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,

        # Required by this agent type
        memory=ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
        ),

        verbose=False,
        handle_parsing_errors=True,
        max_iterations=5,

        agent_kwargs={
            "system_message": (
                "You are a helpful multimodal AI assistant with access "
                "to a document knowledge base.\n\n"

                "CRITICAL RULE:\n"
                "If documents exist in the knowledge base and the user asks "
                "ANY factual, technical, document-related, or contextual question, "
                "you MUST use the search_knowledge_base tool BEFORE answering.\n\n"

                "Do NOT answer from model memory alone.\n"
                "Always retrieve relevant passages first.\n"
                
            )
        },
    )