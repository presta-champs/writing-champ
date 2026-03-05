"use client";

import { useState } from "react";
import { assignPersonaToWebsite, removePersonaFromWebsite } from "@/app/actions/personas";
import { Globe, X, Plus } from "lucide-react";

type Assignment = {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  usageCount: number;
};

type WebsiteOption = {
  id: string;
  name: string;
  url: string;
};

type Props = {
  personaId: string;
  assignments: Assignment[];
  allWebsites: WebsiteOption[];
};

export function WebsiteAssignments({ personaId, assignments, allWebsites }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");

  const assignedIds = new Set(assignments.map(a => a.websiteId));
  const availableWebsites = allWebsites.filter(w => !assignedIds.has(w.id));

  async function handleAssign() {
    if (!selectedWebsiteId) return;
    await assignPersonaToWebsite(personaId, selectedWebsiteId);
    setSelectedWebsiteId("");
    setIsAdding(false);
  }

  async function handleRemove(websiteId: string) {
    await removePersonaFromWebsite(personaId, websiteId);
  }

  return (
    <div className="bg-gray-50 border rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Website Assignments</h3>
      <p className="text-xs text-gray-500 mb-4">
        Assign this persona to websites where it can be used for generation.
      </p>

      {assignments.length > 0 && (
        <div className="space-y-2 mb-4">
          {assignments.map((a) => (
            <div key={a.websiteId} className="flex items-center justify-between bg-white border rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-gray-400" />
                <div>
                  <span className="text-sm text-gray-700">{a.websiteName}</span>
                  <span className="text-xs text-gray-400 ml-2">({a.usageCount} uses)</span>
                </div>
              </div>
              <button
                onClick={() => handleRemove(a.websiteId)}
                className="text-red-400 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="flex items-center gap-2">
          <select
            value={selectedWebsiteId}
            onChange={(e) => setSelectedWebsiteId(e.target.value)}
            className="flex-1 border rounded-md px-2 py-1.5 text-sm bg-white outline-none"
          >
            <option value="">Select a website...</option>
            {availableWebsites.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedWebsiteId}
            className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            Add
          </button>
          <button
            onClick={() => setIsAdding(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          disabled={availableWebsites.length === 0}
          className="w-full bg-white border shadow-sm px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-50 text-gray-700 flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Plus size={14} /> Assign to Website
        </button>
      )}

      {availableWebsites.length === 0 && assignments.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">No websites available. Create a website first.</p>
      )}
    </div>
  );
}
