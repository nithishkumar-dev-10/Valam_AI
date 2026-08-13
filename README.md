<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0b3d0b,50:1a5c1a,100:2e8b2e&height=200&section=header&text=VALAM%20AI&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=AI-Powered%20Farmer%20Assistant%20%E2%80%94%20Nithish%20Kumar%20S&descAlignY=58&descSize=18&descColor=b6f2b6&animation=fadeIn" width="100%"/>

<br/>

```
  🌾  Grow Smarter · Decide Faster · Farm Better  🌱
```

<img src="https://img.shields.io/badge/Platform-Android-2e8b2e?style=flat-square&labelColor=0b3d0b" />
&nbsp;
<img src="https://img.shields.io/badge/Backend-FastAPI-1a5c1a?style=flat-square&labelColor=0b3d0b" />
&nbsp;
<img src="https://img.shields.io/badge/AI-ML%20%7C%20DL%20%7C%20GenAI-4caf50?style=flat-square&labelColor=0b3d0b" />
&nbsp;
<img src="https://img.shields.io/badge/Language-Native%20%2B%20Voice-6fbf73?style=flat-square&labelColor=0b3d0b" />
&nbsp;
<img src="https://img.shields.io/badge/Status-In%20Development-a3d977?style=flat-square&labelColor=0b3d0b" />

</div>

---

## Overview

**Valam** is an Android application built to be a complete digital companion for farmers — helping them decide what to grow, how to protect their crop, when to sell, and how to manage finances and government support, all in their **native language**, with strong **offline support** for rural connectivity conditions.

The application is powered by a deliberate combination of **Machine Learning, Deep Learning, and Generative AI** — each applied only where it genuinely fits the problem — backed by a FastAPI backend and a dedicated mobile frontend.

---

## Problem Statement

Farmers across India face fragmented access to critical information — market prices, soil-specific crop guidance, pest and disease identification, government schemes, and financial record-keeping are scattered across multiple portals, apps, and informal sources. Most existing tools are either too generic, English-only, or require manual research that a farmer with limited digital literacy cannot easily perform.

**Valam consolidates these needs into one application, using AI to translate raw data into direct, actionable guidance.**

---

## Technology Distribution

```
Machine Learning  ████░░░░░░░░░░░░░░░░  1 feature
Deep Learning      ████████████░░░░░░░░  3 features
Generative AI      ████████████████████████████  7 features
```

| Category | Count | Features |
|---|:---:|---|
| **Machine Learning** | 1 | Land & Soil-Based Crop Suggestion |
| **Deep Learning** | 3 | Weed/Pest Detection, Crop Disease Detection, Native Language Voice Assistant |
| **Generative AI** | 7 | Market Advisor, Pesticide Advisor, Expense Tracker, Weather Advisory, Community Assistant, Scheme Assistant, Tutorial Assistant |

---

## Core Features

| # | Feature | Role in the App | Technology |
|:---:|---|---|:---:|
| 1 | **Land & Soil-Based Crop Suggestion** | Recommends the most suitable crop for a farmer's land based on soil nutrients, pH, and regional data | `ML` |
| 2 | **Weed & Pest Detection** | Identifies weeds and pest infestation from a field photo, replacing manual/guess-based weeding decisions | `DL` |
| 3 | **Crop Disease Detection** | Identifies plant disease from a photo of the affected leaf/crop and reports the likely condition | `DL` |
| 4 | **Native Language Voice Assistant** | Enables the farmer to speak queries and receive spoken responses in their native language | `DL` |
| 5 | **Market Price Advisor** | Converts raw mandi price data into a plain-language recommendation on when and where to sell | `GenAI` |
| 6 | **Pesticide & Treatment Advisor** | Provides pesticide type, dosage, and timing guidance based on identified crop and disease | `GenAI` |
| 7 | **Expense Tracker** | Converts natural language or voice input (*"spent 500 on urea"*) into structured expense records automatically | `GenAI` |
| 8 | **Weather-Based Spray Advisory** | Interprets weather forecast data and advises the farmer whether to spray pesticide or hold off | `GenAI` |
| 9 | **Farmer Community Assistant** | Powers a community forum with semantic search and auto-summarization of farmer discussions and tips | `GenAI` |
| 10 | **Government Scheme Assistant** | Answers eligibility and application questions about government schemes in plain language | `GenAI` |
| 11 | **Tutorial Library Assistant** | Summarizes and translates farming tutorials into the farmer's native language | `GenAI` |

---

## Machine Learning Component

### Land & Soil-Based Crop Suggestion

| Detail | Description |
|---|---|
| **Objective** | Predict the most suitable crop for a given land based on soil and environmental parameters |
| **Model Type** | Classification — Random Forest / XGBoost |
| **Input Features** | Nitrogen (N), Phosphorus (P), Potassium (K), soil pH, temperature, humidity, rainfall |
| **Output** | Recommended crop label |
| **Dataset** | Crop Recommendation Dataset (Kaggle), supplemented with the Soil Health Card (SHC) Dataset, Government of India |
| **Serving** | FastAPI endpoint — `POST /predict/crop` |

---

## Deep Learning Components

### Crop Disease Detection

| Detail | Description |
|---|---|
| **Objective** | Identify plant disease from an image of the crop leaf |
| **Model Type** | CNN using transfer learning |
| **Base Architecture** | MobileNetV2 / ResNet18 (pre-trained, fine-tuned) |
| **Dataset** | PlantVillage Dataset — 54,306 labeled images across 14 crop species and 26 diseases |
| **Deployment** | TensorFlow Lite (on-device) or FastAPI endpoint — `POST /predict/disease` |

### Weed & Pest Detection

| Detail | Description |
|---|---|
| **Objective** | Detect weeds or pest damage in a field image |
| **Model Type** | CNN — image classification / object detection |
| **Dataset** | DeepWeeds Dataset, supplemented with pest-damage image subsets |
| **Serving** | FastAPI endpoint — `POST /predict/weed-pest` |

### Native Language Voice Assistant

| Detail | Description |
|---|---|
| **Objective** | Convert farmer speech to text and system text response back to speech, in native language |
| **Model Type** | Pre-trained Speech-to-Text and Text-to-Speech |
| **Models Used** | Whisper (OpenAI) for STT; Google Cloud TTS (or equivalent) for voice output |
| **Dataset** | None required — pre-trained; optional fine-tuning via AI4Bharat regional speech corpora |
| **Serving** | Integrated as a speech pipeline within the FastAPI backend |

---

## Generative AI Components

All Generative AI features are powered by the **Gemini API**, primarily using **Retrieval-Augmented Generation (RAG)** where factual grounding is required, and direct prompting where the task is transformation-based.

| Feature | GenAI Technique | Data Source |
|---|---|---|
| Market Price Advisor | Prompt-based reasoning over live price data | AGMARKNET (data.gov.in) |
| Pesticide & Treatment Advisor | RAG over curated treatment reference data | ICAR advisories |
| Expense Tracker | Structured data extraction from NL/voice input | User-generated input |
| Weather-Based Spray Advisory | Prompt-based reasoning over forecast data | OpenWeatherMap / IMD |
| Farmer Community Assistant | RAG — semantic search + summarization | Embedded community content |
| Government Scheme Assistant | RAG over scheme documentation | Kisan Suvidha, PM-AASHA |
| Tutorial Library Assistant | Summarization + translation | Curated + user-uploaded tutorials |

---

## Backend Architecture

<div align="center">

| Layer | Technology |
|---|---|
| API Framework | FastAPI (Python) |
| Database | PostgreSQL |
| ML/DL Model Serving | FastAPI endpoints, optional TensorFlow Lite for on-device inference |
| GenAI Integration | Gemini API + RAG pipeline (LangChain / LlamaIndex) |
| Vector Database | ChromaDB / FAISS |
| Authentication | JWT-based / Firebase Authentication |
| File & Image Storage | Firebase Storage / AWS S3 |
| Push Notifications | Firebase Cloud Messaging |
| Deployment | Render / Railway / Google Cloud Run |
| Frontend | Flutter / Native Android, integrating with documented FastAPI endpoints |

</div>

---

## Repository Structure

```
Valam_AI/
│
├── app/
│   ├── auth/              → JWT authentication
│   ├── ml_models/          → Trained model artifacts (.pt / .pkl)
│   ├── models/              → Database table definitions (SQLAlchemy)
│   ├── routers/             → API endpoints
│   ├── schemas/              → Request/response validation (Pydantic)
│   ├── services/
│   │   ├── ml/                → Crop suggestion serving
│   │   ├── dl/                → Disease, weed/pest, and voice serving
│   │   ├── genai/             → All Gemini/RAG-powered features
│   │   └── external/          → Third-party data APIs (AGMARKNET, weather)
│   ├── utils/                → Helper functions, logging, exceptions
│   ├── vector_store/          → Persisted RAG embeddings
│   ├── config.py
│   ├── database.py
│   └── main.py
│
├── data/                    → Raw datasets
├── scripts/                  → Training + ingestion jobs
│   ├── train_crop_model.py
│   ├── train_disease_model.py
│   ├── train_weedpest_model.py
│   └── ingest_scheme_docs.py
│
├── tests/                     → Automated + manual test scripts
├── requirements.txt
└── README.md                   ← you are here
```

---

## Skills Demonstrated

- Structured prediction via classical Machine Learning (Random Forest / XGBoost)
- Transfer learning for visual classification (CNNs, MobileNetV2 / ResNet18)
- Speech pipeline integration (STT/TTS) for native-language accessibility
- Retrieval-Augmented Generation for factual, source-grounded GenAI responses
- Multi-paradigm system design — ML, DL, and GenAI unified under one FastAPI backend
- Offline-first architecture considerations for low-connectivity rural deployment
- Government and agricultural data integration (AGMARKNET, Soil Health Card, ICAR)

---

## Project Status

| Component | Status |
|---|:---:|
| Land & Soil-Based Crop Suggestion (ML) | Completed |
| Crop Disease Detection (DL) | Completed |
| Weed & Pest Detection (DL) | In Progress |
| Native Language Voice Assistant (DL) | Planned |
| Generative AI Feature Suite (7 features) | Planned |

---

## Closing Note

Valam combines **1 Machine Learning model, 3 Deep Learning models, and 7 Generative AI-powered features** into a single, coherent FastAPI backend. Each technology is applied where it is best suited — structured prediction through Machine Learning, visual and audio understanding through Deep Learning, and language-based reasoning through Generative AI — resulting in a technically sound and practically useful application for farmers.

<div align="center">

**Nithish Kumar S** · B.Tech, Computer Science

</div>
