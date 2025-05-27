import { Message } from "@ai-sdk/react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import Markdown from "markdown-to-jsx";
import { ToolResponse } from "./ToolResponse";

interface EditableMessageProps {
  message: Message;
  onEdit: (messageId: string, newContent: string) => void;
  currentEmotion: string;
}

export function EditableMessage({
  message,
  onEdit,
  currentEmotion,
}: EditableMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message.parts) {
      const textParts = message.parts
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");
      setEditedContent(textParts || message.content || "");
    } else {
      setEditedContent(message.content || "");
    }
  }, [message]);

  useEffect(() => {
    if (isEditing && editableRef.current) {
      editableRef.current.focus();
      // Place cursor at the end
      const range = document.createRange();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [isEditing]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const content = editableRef.current?.textContent || "";
      onEdit(message.id, content);
      setIsEditing(false);
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  const markdownOptions = {
    disableParsingRawHTML: true,
  };

  const getEmotionStyle = (emotion: string) => {
    const styles: Record<string, string> = {
      Happy: "bg-green-100 border-green-200",
      Excited: "bg-yellow-100 border-yellow-200",
      Sad: "bg-blue-100 border-blue-200",
      Angry: "bg-red-100 border-red-200",
      Neutral: "bg-muted",
      Confused: "bg-purple-100 border-purple-200",
      Thoughtful: "bg-indigo-100 border-indigo-200",
      Curious: "bg-orange-100 border-orange-200",
      Amused: "bg-pink-100 border-pink-200",
      Focused: "bg-teal-100 border-teal-200",
      Explaining: "bg-gray-100 border-gray-200",
      Patient: "bg-lime-100 border-lime-200",
      SlightlyAnnoyed: "bg-amber-100 border-amber-200",
      Frustrated: "bg-red-100 border-red-200",
      Mad: "bg-red-100 border-red-200",
      PissedOff: "bg-red-100 border-red-200",
      Intrigued: "bg-purple-100 border-purple-200",
      Sarcastic: "bg-gray-100 border-gray-200",
      Disappointed: "bg-gray-100 border-gray-200",
    };
    return styles[emotion] || styles.Neutral;
  };

  const renderMessageContent = () => {
    if (message.parts && message.parts.length > 0) {
      return message.parts.map((part, i) => {
        if (part.type === "text") {
          return (
            <div key={i} className="markdown-content">
              <Markdown options={markdownOptions}>{part.text}</Markdown>
            </div>
          );
        }
        if (part.type === "tool-invocation") {
          return <ToolResponse key={i} toolInvocation={part.toolInvocation} />;
        }
        return null;
      });
    }
    // Fallback to content if no parts are available
    return (
      <div className="markdown-content">
        <Markdown options={markdownOptions}>{message.content || ""}</Markdown>
      </div>
    );
  };

  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`relative max-w-[80%] md:max-w-[70%] px-4 py-2 rounded-lg border ${
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : getEmotionStyle(currentEmotion)
        } ${message.role === "user" ? "group cursor-pointer" : ""}`}
        onClick={() => {
          if (message.role === "user" && !isEditing) {
            setIsEditing(true);
          }
        }}
      >
        {message.role === "user" && !isEditing && (
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100">
              edit
            </span>
          </div>
        )}
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            className="whitespace-pre-wrap outline-none min-w-[4rem]"
            dangerouslySetInnerHTML={{ __html: editedContent }}
          />
        ) : (
          renderMessageContent()
        )}
      </div>
    </div>
  );
}
