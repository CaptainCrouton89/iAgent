# Memory Chat Interface

This directory contains the memory-augmented chat interface where users interact with an AI that has access to their conversation history.

## Components

### ChatContainer.tsx
- Main container for displaying messages
- Auto-scrolls to latest message
- Handles loading states

### EditableMessage.tsx
- Renders individual messages with role-based styling
- User messages are editable on click
- Emotion-based styling for assistant messages
- Integrates tool responses via message parts

### ToolResponse.tsx
- Renders tool invocations and results
- Supported tools:
  - `searchMemories`: Shows query parameters and results
  - `inspectMemory`: Shows memory ID and full transcript in collapsible view
  - `getSystemInfo`: Legacy tool support
- Each tool has three states: call, result, partial-call

### MessageBubble.tsx
- Simple message display component
- Used in other parts of the app

### SaveConversationButton.tsx
- Saves current conversation to long-term memory
- Generates embeddings and compressed summaries
- Shows save progress and confirmation

## Page Structure

The main page (`page.tsx`) orchestrates:
1. Message history management
2. Emotion tracking
3. Interaction lessons loading
4. Real-time streaming responses
5. Message editing capabilities

## Memory Tool Integration

When the AI uses memory tools:
1. `searchMemories` returns memories with `[ID: uuid]` format
2. AI can extract IDs and use `inspectMemory` for full details
3. Results display inline with conversation flow

## Emotion System

Assistant emotions affect:
- Message bubble colors (see `getEmotionStyle` in EditableMessage)
- Response tone and content
- Tracked across conversation for consistency