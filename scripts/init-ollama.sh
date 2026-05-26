#!/bin/bash
# ─── Orbivex: Ollama Model Initialization ───

echo "⏳ Waiting for Ollama to start..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done

echo "📥 Pulling Phi3 model (quiz generation, recommendations)..."
docker exec orbivex-ollama ollama pull phi

echo "📥 Pulling Mistral model (grading, plagiarism detection)..."
docker exec orbivex-ollama ollama pull mistral

echo "✅ All models loaded!"
echo "🔍 Available models:"
docker exec orbivex-ollama ollama list
