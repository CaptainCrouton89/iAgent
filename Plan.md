Phase 1: Semantic Memory Foundations

Goal: Introduce semantic memory derived from episodic data, with structured, deduplicated storage. 1. Define Semantic Memory Schema
• Fields:
• id
• type: "fact" | "theme" | "summary"
• content: Natural language summary or fact
• embedding: Vector representation
• confidence: Initial + dynamic scoring
• strength: memory decay float, similar to strength for episodic memories
• provenance: Episode IDs + timestamps
• related_memories: Array of semantic memory uuids related to this one.
• last_updated 2. Set Up Semantic Memory Store
• Separate collection/table.
• Indexed by embedding, type, and content.
• Deduplication enforced at insertion time.

⸻

Phase 2: Dream Phase — Theme Extraction and Semantic Reconciliation

Goal: Periodically extract meaningful themes from episodic memory and reconcile with existing semantic memory to avoid bloat. 1. Triggering
• Scheduled (e.g., daily cron job or after N new episodes). 2. Extraction Process
• Step 1: Pull recent episodic embeddings (e.g., last 100 episodes).
• Step 2: Cluster using a scalable algorithm (e.g., k-means, HDBSCAN).
• Step 3: For each cluster:
• Summarize using LLM to extract representative facts.
• Generate candidate semantic memories (proposed_facts). 3. Reconciliation Pipeline
• For each proposed_fact: 1. Similarity Check: Compute cosine similarity with existing semantic memory embeddings. 2. Threshold Logic:
• If high similarity (≥ threshold): update confidence, append new provenance, update last_updated.
• If medium similarity: optionally merge or rewrite.
• If low similarity: add as new semantic memory only if novel enough (e.g., above novelty score threshold).
• Update knowledge graph 3. Confidence Adjustment:
• Reinforce matching entries.
• Decay unmatched entries over time (if stale, remove).
• We already have a decay method for episodic memories, use this to also decay these memories instead 4. Retention Control
• Semantic memory capped in size or pruned by:
• Confidence score decay.
• Relevance ranking.
• Access frequency.

⸻

Phase 3: Semantic Memory Query Interface

Goal: Provide functional access to stored semantic memories. 1. Implement search_semantic_memory(query)
• Embedding-based similarity search.
• Filter by type, confidence, or time bounds. 2. Add Provenance Linking
• Results include links to source episodes. 3. Update the search-tool so that it takes in "search-mode" of "semantic", "episodic", or "hybrid".
• Factual/summary/generalization → semantic
• Time/event-specific → episodic
• Hybrid/fallback → query both

⸻

Notes
• No new semantic memory is accepted without reconciliation.
• Memory bloat is controlled via similarity thresholding, deduplication, and decay.
• Dream phase acts as a high-precision summarizer, not a passive aggregator.
