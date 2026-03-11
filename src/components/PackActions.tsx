"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { upsertWords, Word } from "@/lib/api";
import { useRouter } from "next/navigation";

interface PackActionsProps {
  packId: string;
  packName: string;
  words: (Word & {
    mastery_score: number;
  })[];
}

export function PackActions({ packId, packName, words }: PackActionsProps) {
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();

  const handleExport = () => {
    try {
      const exportData: Record<string, string> = {};
      words.forEach((w) => {
        exportData[w.word] = w.translation;
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${packName.toLowerCase().replace(/\s+/g, "_")}_words.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Vocabulary exported successfully!");
    } catch (err) {
      toast.error("Failed to export vocabulary");
      console.error(err);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const json: Record<string, string> = JSON.parse(text);

      const wordsToInsert = Object.entries(json).map(([word, translation]) => ({
        pack_id: packId,
        word: word.trim(),
        translation: translation.trim(),
      }));

      if (wordsToInsert.length === 0) {
        toast.error("No valid words found in JSON");
        return;
      }

      await upsertWords(wordsToInsert);
      toast.success(`Successfully imported ${wordsToInsert.length} words!`);
      router.refresh();
    } catch (err) {
      toast.error("Invalid JSON format. Expected: {\"word\": \"translation\"}");
      console.error(err);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative">
        <Input
          type="file"
          accept=".json"
          onChange={handleImport}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isImporting}
        />
        <Button variant="outline" className="gap-2 pointer-events-none" disabled={isImporting}>
          <Upload size={16} />
          {isImporting ? "Importing..." : "Import JSON"}
        </Button>
      </div>

      <Button variant="outline" className="gap-2" onClick={handleExport} disabled={words.length === 0}>
        <Download size={16} />
        Export JSON
      </Button>
    </div>
  );
}
