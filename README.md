# SARGPT – Multimodal AI Assistant Platform

SARGPT is a multimodal AI assistant that enables users to interact through **text, voice, images, and documents** within a unified conversational experience. The platform combines **Conversational AI, Retrieval-Augmented Generation (RAG), Agent-based Orchestration, and Guardrails** to deliver intelligent, context-aware responses.

Built using **FastAPI** and **React**, SARGPT is containerized with **Docker** and deployed on **Kubernetes** with multi-pod scaling for improved reliability and scalability.

---

## Features

* Conversational AI with session-based memory
* Text, Voice, Image, and Document inputs
* Knowledge Base Search (RAG)
* LangChain Agent Orchestration
* Nemo Guardrails Integration
* Profanity & Safety Filtering
* React Frontend + FastAPI Backend
* Docker Containerization
* Kubernetes Deployment with Multi-Pod Scaling

---

## Tech Stack

### AI & NLP

* OpenAI
* LangChain
* Hugging Face Models
* Nemo Guardrails

### Backend

* Python
* FastAPI
* Uvicorn

### Frontend

* React
* JavaScript (JSX)
* Vite

### DevOps

* Docker
* Kubernetes
* GitHub



---

## Quick Start

### Docker Deployment

Build Docker Image:

```bash
docker build -t myapp:v3 .
```

Run Container:

```bash
docker run -p 8000:8000 --env-file .env myapp:v3
```

Access Swagger UI:

```text
http://localhost:8000/docs
```

---

### Kubernetes Deployment

Deploy Application:

```bash
kubectl apply -f k8s/
```

Verify Pods:

```bash
kubectl get pods
```

Port Forward Service:

```bash
kubectl port-forward service/multimodal-agent-service 8080:80
```

Access Swagger UI:

```text
http://localhost:8080/docs
```



## Future Enhancements

* Cloud Deployment
* CI/CD Automation
* Horizontal Pod Autoscaling
* Advanced Multi-Agent Workflows
* Monitoring & Observability

---

