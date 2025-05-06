"use client";

import { OnChange } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamically import Monaco Editor with no SSR
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language = "javascript",
  height = "300px",
}: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle Monaco editor onChange which might return undefined
  const handleEditorChange: OnChange = (value) => {
    onChange(value || "");
  };

  // For server-side rendering compatibility
  if (!mounted) {
    return (
      <textarea
        className="w-full p-4 font-mono text-sm border rounded-md resize-none"
        style={{ height }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <MonacoEditor
      value={value}
      onChange={handleEditorChange}
      language={language}
      height={height}
      options={{
        minimap: {
          enabled: false,
        },
        fontSize: 14,
        wordWrap: "on",
        tabSize: 2,
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
