"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Circle, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  createdBy: { name: string | null; email: string };
  createdAt: string;
}

const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700", icon: ChevronUp },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700", icon: Circle },
  LOW: { label: "Low", color: "bg-gray-100 text-gray-600", icon: ChevronDown },
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  TODO: { label: "To Do", color: "bg-gray-100 text-gray-700", icon: Circle },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-100 text-amber-700", icon: Clock },
  DONE: { label: "Done", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "TODO" | "IN_PROGRESS" | "DONE">("all");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos");
      const data = await res.json();
      setTodos(data.todos || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc, priority: newPriority }),
      });
      setShowAdd(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("MEDIUM");
      fetchTodos();
    } catch {}
    setSaving(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      await fetch("/api/todos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      fetchTodos();
    } catch { fetchTodos(); }
  };

  const handleDelete = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/todos?id=${id}`, { method: "DELETE" });
    } catch { fetchTodos(); }
  };

  const filtered = todos.filter(t => filter === "all" || t.status === filter);
  const counts = {
    all: todos.length,
    TODO: todos.filter(t => t.status === "TODO").length,
    IN_PROGRESS: todos.filter(t => t.status === "IN_PROGRESS").length,
    DONE: todos.filter(t => t.status === "DONE").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">To-Do List</h2>
          <p className="text-sm text-muted-foreground">Track tasks and feature requests</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Task
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["all", "TODO", "IN_PROGRESS", "DONE"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All (${counts.all})` :
             f === "TODO" ? `To Do (${counts.TODO})` :
             f === "IN_PROGRESS" ? `In Progress (${counts.IN_PROGRESS})` :
             `Done (${counts.DONE})`}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/30" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{filter === "all" ? "No tasks yet" : `No ${statusConfig[filter]?.label.toLowerCase()} tasks`}</p>
            <p className="text-sm text-muted-foreground">Add a task to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(todo => {
            const priority = priorityConfig[todo.priority];
            const status = statusConfig[todo.status];
            const StatusIcon = status.icon;
            const isExpanded = expandedId === todo.id;

            return (
              <div
                key={todo.id}
                className={`rounded-lg border p-3 transition-colors ${
                  todo.status === "DONE" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status toggle button */}
                  <button
                    onClick={() => {
                      const next = todo.status === "TODO" ? "IN_PROGRESS" : todo.status === "IN_PROGRESS" ? "DONE" : "TODO";
                      handleStatusChange(todo.id, next);
                    }}
                    className="mt-0.5 shrink-0"
                    title="Click to change status"
                  >
                    <StatusIcon className={`h-5 w-5 ${
                      todo.status === "DONE" ? "text-emerald-500" :
                      todo.status === "IN_PROGRESS" ? "text-amber-500" : "text-gray-400"
                    }`} />
                  </button>

                  <div className="min-w-0 flex-1" onClick={() => setExpandedId(isExpanded ? null : todo.id)}>
                    <p className={`text-sm font-medium ${todo.status === "DONE" ? "line-through" : ""}`}>
                      {todo.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priority.color}`}>
                        {priority.label}
                      </span>
                      {todo.description && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">
                        {todo.createdBy.name || todo.createdBy.email} · {new Date(todo.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {isExpanded && todo.description && (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{todo.description}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Add details, notes, or feature requirements..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !newTitle.trim()}>
              {saving ? "Adding..." : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
