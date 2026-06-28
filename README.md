<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>
# 🤖 Companion Agent

> A full-stack, AI-native SaaS application that leverages multi-agent AI analysis to provide intelligent code insights, security audits, and performance optimization recommendations—all built entirely in the cloud.

![TypeScript](https://img.shields.io/badge/TypeScript-97.9%25-blue)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Powered-orange)
![Firebase](https://img.shields.io/badge/Firebase-Cloud%20Hosted-yellow)

---

## 📋 Overview

Companion Agent is a sophisticated AI-powered code analysis platform that orchestrates multiple specialized AI agents to provide comprehensive code reviews. Each agent specializes in a different aspect of code quality:

- **🐛 Bug Hunter**: Identifies bugs, security vulnerabilities, edge cases, and safety issues with OWASP Top 10 compliance mapping
- **⚡ Complexity Optimizer**: Analyzes algorithmic performance with Big O notation and suggests optimizations
- **📚 Doc Generator**: Generates comprehensive code documentation with JSDoc/Docstring annotations

The system is built as a cloud-native SaaS application with a React frontend, Express backend, and Google Gemini AI integration.

---

## 🎯 Key Features

- **Multi-Agent Architecture**: Three specialized AI agents analyze code from different perspectives
- **Security-First Analysis**: OWASP Top 10 vulnerability detection and classification
- **Performance Analysis**: Big O complexity analysis with optimization recommendations
- **Auto-Documentation**: Intelligent code documentation generation
- **Structured Output**: JSON responses with detailed findings and actionable fixes
- **Production-Ready**: Exponential backoff retry logic for API resilience
- **Cloud-Native**: Built on Firebase and deployed on cloud infrastructure

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 19
- Vite (fast bundler)
- Tailwind CSS (styling)
- Motion (animations)
- Lucide React (icons)

**Backend:**
- Node.js + TypeScript
- Express.js (REST API)
- Google Generative AI SDK
- Firebase (backend services)

**Cloud Infrastructure:**
- Firebase Firestore (database)
- Cloud Deployment

### Project Structure


# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/685ff2e4-be26-4564-9fd1-62228fca51c3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
