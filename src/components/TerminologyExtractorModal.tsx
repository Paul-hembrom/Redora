import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Document } from '../types';
import { extractTerminology } from '../lib/gemini';
import { BookA, Download, Loader2, Play, Search, Trash2, Edit2, Check, X, FileText, AlertCircle, Plus } from 'lucide-react';

interface Term {
  term: string;
  definition: string;
}

interface TerminologyExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export default function TerminologyExtractorModal({ isOpen, onClose, document: doc }: TerminologyExtractorModalProps) {
  const [selectedSource, setSelectedSource] = useState<string>('all'); // 'all' or specific chapter/topic ID
  const [customFocus, setCustomFocus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [filterQuery, setFilterQuery] = useState<string>('');
  
  // State for inline editing of terms
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTermName, setEditTermName] = useState<string>('');
  const [editTermDef, setEditTermDef] = useState<string>('');

  // State for manually adding a term
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTermName, setNewTermName] = useState<string>('');
  const [newTermDef, setNewTermDef] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setCustomFocus('');
      setError(null);
      setTerms([]);
      setEditingIndex(null);
      setShowAddForm(false);
      setFilterQuery('');
    }
  }, [isOpen]);

  if (!doc) return null;

  // Flatten chapters to access topics/subchapters
  const flattenChapters = (chapters: any[] = []): any[] => {
    const list: any[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach(node => {
        list.push(node);
        if (node.children && node.children.length > 0) {
          traverse(node.children);
        }
      });
    };
    traverse(chapters);
    return list;
  };

  const flatChapters = flattenChapters(doc.chapters);

  const handleExtract = async () => {
    setIsLoading(true);
    setError(null);
    setTerms([]);

    try {
      let contentToProcess = '';
      if (selectedSource === 'all') {
        // Concatenate all content with headings
        contentToProcess = flatChapters
          .map(ch => `### ${ch.title}\n${ch.content || ''}`)
          .join('\n\n');
      } else {
        const found = flatChapters.find(ch => ch.id === selectedSource);
        contentToProcess = found?.content || '';
      }

      if (!contentToProcess.trim()) {
        throw new Error("The selected source does not contain any readable content.");
      }

      const promptModifier = customFocus.trim() 
        ? `Identify and extract the most important technical terms, vocabulary, jargon, concepts, or events from the text, specifically focusing on: "${customFocus}". Provide clear, precise, and educational definitions suited for study and flashcards like Anki.`
        : undefined;

      // Restrict content length to a safe value
      const content = contentToProcess.substring(0, 30000);
      const extracted = await extractTerminology(content, promptModifier);
      
      if (!extracted || extracted.length === 0) {
        throw new Error("No terminologies were successfully extracted. Try selecting a different section or refining your focus criteria.");
      }

      setTerms(extracted);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "An unexpected error occurred during terminology extraction.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTerm = (index: number) => {
    setTerms(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleStartEdit = (index: number, term: Term) => {
    setEditingIndex(index);
    setEditTermName(term.term);
    setEditTermDef(term.definition);
  };

  const handleSaveEdit = (index: number) => {
    if (!editTermName.trim() || !editTermDef.trim()) return;
    setTerms(prev => prev.map((t, i) => i === index ? { term: editTermName.trim(), definition: editTermDef.trim() } : t));
    setEditingIndex(null);
  };

  const handleAddTerm = () => {
    if (!newTermName.trim() || !newTermDef.trim()) return;
    setTerms(prev => [{ term: newTermName.trim(), definition: newTermDef.trim() }, ...prev]);
    setNewTermName('');
    setNewTermDef('');
    setShowAddForm(false);
  };

  const exportJSON = () => {
    if (terms.length === 0) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(terms, null, 2))}`;
    const downloadAnchor = window.document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `glossary-${doc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    window.document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCSVForAnki = () => {
    if (terms.length === 0) return;
    // Format for standard Anki import (CSV, separator value comma)
    const csvContent = terms.map(t => {
      const escapedTerm = t.term.replace(/"/g, '""');
      const escapedDef = t.definition.replace(/"/g, '""');
      return `"${escapedTerm}","${escapedDef}"`;
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = window.document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `anki-${doc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    window.document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const filteredTerms = terms.filter(t => 
    t.term.toLowerCase().includes(filterQuery.toLowerCase()) || 
    t.definition.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] p-0 bg-[#0a0a0a] border-white/10 text-white flex flex-col overflow-hidden shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-4 bg-[#0d0d0d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BookA className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Terminology Extractor</h2>
              <p className="text-xs text-white/40 font-light truncate max-w-[450px]">
                Analyze <span className="text-emerald-300 font-medium">{doc.name}</span> context
              </p>
            </div>
          </div>
        </div>

        {/* Form Settings / Parameters */}
        <div className="p-6 bg-black/40 border-b border-white/5 space-y-4 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Select Text Source</label>
              <select
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/95 focus:outline-none focus:border-emerald-500/50 transition-colors"
                disabled={isLoading}
              >
                <option value="all">Entire Document (All chapters)</option>
                {flatChapters.map(ch => (
                  <option key={ch.id} value={ch.id}>
                    Source: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Custom Extraction Focus (Optional)</label>
              <input
                type="text"
                value={customFocus}
                onChange={e => setCustomFocus(e.target.value)}
                placeholder="e.g. key dates, mathematical formulas, core algorithms"
                className="w-full bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/95 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-white/30 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Uses deep semantic analysis to construct premium card-ready items.
            </div>

            <button
              onClick={handleExtract}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 disabled:opacity-40 text-sm font-semibold text-white rounded-lg transition-all active:scale-95 shadow-md shadow-emerald-900/10 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Extract Terminology
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results / List Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px] bg-[#070707] flex flex-col justify-start">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex gap-2 items-start mb-4">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Extraction Failed</p>
                <p className="text-xs text-red-400/80 leading-relaxed mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {terms.length > 0 ? (
            <div className="space-y-4">
              {/* Filter and Add Controls */}
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder="Filter extracted terms..."
                    className="w-full bg-[#111111] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white/80 focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
                <button
                  onClick={() => setShowAddForm(p => !p)}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 rounded-lg px-3 py-2 text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New Term
                </button>
              </div>

              {/* Add form inline */}
              {showAddForm && (
                <div className="bg-[#121212] border border-emerald-500/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Add Custom Term</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    <input
                      type="text"
                      placeholder="Term..."
                      value={newTermName}
                      onChange={e => setNewTermName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/55"
                    />
                    <textarea
                      placeholder="Definition..."
                      rows={2}
                      value={newTermDef}
                      onChange={e => setNewTermDef(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/55 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 text-[10px] font-bold">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-2.5 py-1 text-white/50 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTerm}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
                    >
                      Add Term
                    </button>
                  </div>
                </div>
              )}

              {/* Terms feed */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {filteredTerms.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs">No matching terms found.</div>
                ) : (
                  filteredTerms.map((t, idx) => {
                    const isEditing = idx === editingIndex;

                    return (
                      <div
                        key={idx}
                        className="group bg-white/[0.02] border border-white/5 rounded-xl p-3.5 hover:bg-white/[0.04] hover:border-white/10 transition-all flex justify-between gap-3"
                      >
                        {isEditing ? (
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={editTermName}
                              onChange={e => setEditTermName(e.target.value)}
                              className="w-full bg-[#1f1f1f] border border-white/10 rounded-md px-2.5 py-1 text-xs font-bold text-white focus:outline-none"
                            />
                            <textarea
                              value={editTermDef}
                              onChange={e => setEditTermDef(e.target.value)}
                              rows={2}
                              className="w-full bg-[#1f1f1f] border border-white/10 rounded-md px-2.5 py-1 text-xs text-white/80 focus:outline-none resize-none"
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="p-1 text-white/40 hover:text-white transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSaveEdit(idx)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-emerald-300 tracking-wide line-clamp-2">{t.term}</h4>
                              <p className="text-xs text-white/70 leading-relaxed mt-1">{t.definition}</p>
                            </div>
                            <div className="flex items-start gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(idx, t)}
                                className="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                                title="Edit terminology definition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTerm(idx)}
                                className="p-1.5 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
                                title="Delete terminology"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="relative w-12 h-12 mx-auto">
                    <div className="absolute inset-0 rounded-full border border-emerald-500/10" />
                    <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                  </div>
                  <p className="text-xs text-white/50 font-light">
                    Mapping concepts & formulating dictionary-level definitions...
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-w-md">
                  <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-white/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white/90">No Terminology Loaded</h3>
                    <p className="text-xs text-white/40 leading-relaxed max-w-xs mx-auto mt-1">
                      Choose your document scope above and click "Extract Terminology" to generate a vocabulary bank.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-xs text-white/40">
            {terms.length > 0 && (
              <>
                <span className="text-emerald-400 font-semibold">{terms.length}</span> terms ready
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-white/70 hover:text-white bg-transparent border border-white/10 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            
            {terms.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportJSON}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 rounded-lg font-medium transition-colors cursor-pointer"
                  title="Export raw terminology as a JSON list"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  onClick={exportCSVForAnki}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors shadow-md shadow-cyan-900/15 cursor-pointer animate-pulse"
                  title="Export file pre-formatted for direct import as flashcards into Anki"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV (Anki)
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
