"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Plug,
  User,
  Users as UsersIcon,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Link as LinkIcon,
  Unlink,
  Plus,
  Trash2,
  Pencil,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface IntacctStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  tokenExpiresAt?: string;
  connectedAt?: string;
  cycleCountCount?: number;
}

interface ManagedUser {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [sageStatus, setSageStatus] = useState<
    "idle" | "testing" | "connected" | "failed"
  >("idle");
  const [sageMessage, setSageMessage] = useState("");
  const [intacct, setIntacct] = useState<IntacctStatus | null>(null);
  const [intacctLoading, setIntacctLoading] = useState(true);
  const currentUserId = (session?.user as any)?.id;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "USER" as "USER" | "ADMIN",
  });
  const [userFormError, setUserFormError] = useState("");
  const [userFormSaving, setUserFormSaving] = useState(false);

  // Reassign-on-delete state
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [reassignInfo, setReassignInfo] = useState<{
    linked: {
      inventoryItems: number;
      scanLogs: number;
      cycleCountsCreated: number;
      cycleCountsAssigned: number;
      todos: number;
      total: number;
    };
  } | null>(null);
  const [reassignToId, setReassignToId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const testSageConnection = async () => {
    setSageStatus("testing");
    try {
      const res = await fetch("/api/sage/sync?test=true");
      const data = await res.json();
      setSageStatus(data.connected ? "connected" : "failed");
      setSageMessage(data.message);
    } catch {
      setSageStatus("failed");
      setSageMessage("Network error");
    }
  };

  const fetchIntacctStatus = useCallback(async () => {
    setIntacctLoading(true);
    try {
      const res = await fetch("/api/intacct/status");
      const data = await res.json();
      setIntacct(data);
    } catch {
      setIntacct({
        configured: false,
        connected: false,
        message: "Failed to check status",
      });
    }
    setIntacctLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    fetchIntacctStatus();
    fetchUsers();
  }, [fetchIntacctStatus, fetchUsers]);

  const resetUserForm = () => {
    setUserForm({ email: "", name: "", password: "", role: "USER" });
    setUserFormError("");
  };

  const handleOpenAddUser = () => {
    resetUserForm();
    setEditUser(null);
    setShowAddUser(true);
  };

  const handleOpenEditUser = (u: ManagedUser) => {
    setUserForm({ email: u.email, name: u.name || "", password: "", role: u.role });
    setUserFormError("");
    setEditUser(u);
    setShowAddUser(false);
  };

  const handleSaveUser = async () => {
    setUserFormError("");
    setUserFormSaving(true);
    try {
      let res: Response;
      if (editUser) {
        res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editUser.id,
            name: userForm.name,
            role: userForm.role,
            password: userForm.password || undefined,
          }),
        });
      } else {
        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userForm),
        });
      }
      if (res.ok) {
        setShowAddUser(false);
        setEditUser(null);
        resetUserForm();
        fetchUsers();
      } else {
        const err = await res.json();
        setUserFormError(err.error || "Failed");
      }
    } catch {
      setUserFormError("Network error");
    }
    setUserFormSaving(false);
  };

  const handleDeleteUser = async (u: ManagedUser) => {
    if (!confirm(`Delete user ${u.email}? If they own records you'll be asked where to reassign them next.`)) return;
    setDeleteError("");
    setReassignInfo(null);
    setReassignToId("");
    const res = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
      return;
    }
    const err = await res.json();
    if (err.code === "REASSIGN_REQUIRED") {
      setDeleteTarget(u);
      setReassignInfo({ linked: err.linked });
      return;
    }
    alert(err.error || "Could not delete");
  };

  const handleConfirmReassignDelete = async () => {
    if (!deleteTarget || !reassignToId) return;
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/users?id=${deleteTarget.id}&reassignToId=${reassignToId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setDeleteTarget(null);
        setReassignInfo(null);
        setReassignToId("");
        fetchUsers();
      } else {
        const err = await res.json();
        setDeleteError(err.error || "Could not delete");
      }
    } catch {
      setDeleteError("Network error");
    }
    setDeleting(false);
  };

  const intacctCallbackStatus = searchParams.get("intacct");
  const intacctCallbackMessage = searchParams.get("message");

  const handleDisconnect = async () => {
    if (!confirm("Disconnect from Sage Intacct? You'll need to re-authorize.")) return;
    await fetch("/api/intacct/disconnect", { method: "POST" });
    fetchIntacctStatus();
  };

  return (
    <div className="space-y-4">
      {/* User Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">
              {session?.user?.name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">
              {session?.user?.email || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary">
              {(session?.user as any)?.role || "USER"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* User Accounts (admin) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="h-4 w-4 text-primary" />
            User accounts
          </CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={handleOpenAddUser}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add user
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-1">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {u.name || u.email}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditUser(u)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.id === currentUserId}
                          title={u.id === currentUserId ? "You can't delete yourself" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
          <p className="pt-2 text-xs text-muted-foreground">
            <KeyRound className="mr-1 inline h-3 w-3" />
            Everyone (including admins) can change their own password on the <a href="/account" className="underline">My Account</a> page.
          </p>
        </CardContent>
      </Card>

      {/* Sage Intacct REST (OAuth) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" />
            Sage Intacct (REST)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {intacctCallbackStatus === "connected" && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Successfully connected to Sage Intacct
            </div>
          )}
          {intacctCallbackStatus === "error" && (
            <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Connection failed: {intacctCallbackMessage || "Unknown error"}</span>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            One admin connects the app to Sage Intacct via OAuth 2.0. All users share this connection.
          </p>

          {intacctLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking status...
            </div>
          ) : intacct ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {intacct.connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
                ) : intacct.configured ? (
                  <Badge variant="secondary">Not connected</Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
              </div>

              {intacct.connectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm font-medium">
                    {new Date(intacct.connectedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {intacct.tokenExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token expires</span>
                  <span className="text-sm font-medium">
                    {new Date(intacct.tokenExpiresAt).toLocaleString()}
                  </span>
                </div>
              )}

              {typeof intacct.cycleCountCount === "number" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cycle counts in Intacct</span>
                  <span className="text-sm font-medium">{intacct.cycleCountCount}</span>
                </div>
              )}

              {intacct.message && (
                <p className="text-xs text-muted-foreground">{intacct.message}</p>
              )}

              <div className="flex gap-2 pt-1">
                {intacct.connected ? (
                  isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                    >
                      <Unlink className="mr-2 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  )
                ) : (
                  isAdmin && intacct.configured && (
                    <Button
                      size="sm"
                      onClick={() => (window.location.href = "/api/intacct/auth")}
                    >
                      <LinkIcon className="mr-2 h-3.5 w-3.5" />
                      Connect to Sage
                    </Button>
                  )
                )}
                {!isAdmin && !intacct.connected && (
                  <p className="text-xs text-muted-foreground">Admin must authorize the app.</p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Sage Intacct XML Gateway (fallback) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-muted-foreground" />
            Sage Intacct (XML Gateway — fallback)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Legacy XML API. Only used if the REST integration is unavailable.
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={testSageConnection}
              disabled={sageStatus === "testing"}
            >
              {sageStatus === "testing" && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Test Connection
            </Button>

            {sageStatus === "connected" && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </div>
            )}
            {sageStatus === "failed" && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                Failed
              </div>
            )}
          </div>

          {sageMessage && (
            <p className="text-xs text-muted-foreground">{sageMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* Database */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Engine</span>
            <Badge variant="outline">MariaDB</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ORM</span>
            <Badge variant="outline">Prisma</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All scan events are logged with timestamps, user IDs, and action
            types. Access the full audit log via the API at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /api/scan?logs=true
            </code>
          </p>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center text-xs text-muted-foreground">
        <p>InvScan v1.0.0</p>
        <p>Next.js + shadcn/ui + MariaDB + Prisma</p>
      </div>

      {/* Add/Edit User dialog */}
      <Dialog
        open={showAddUser || !!editUser}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddUser(false);
            setEditUser(null);
            resetUserForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit user" : "Add user"}</DialogTitle>
            <DialogDescription>
              {editUser
                ? "Update the user's display name, role, or reset their password."
                : "Create a new account. Give them an initial password — they can change it on the My Account page."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                disabled={!!editUser}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Display name</Label>
              <Input
                value={userForm.name}
                onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(v: "USER" | "ADMIN") => setUserForm({ ...userForm, role: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins see Settings. Users don't.
              </p>
            </div>
            <div className="space-y-1">
              <Label>
                {editUser ? "Reset password (leave blank to keep)" : "Initial password"}
              </Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                placeholder={editUser ? "Leave blank to keep existing" : "Min 8 characters"}
                autoComplete="new-password"
              />
            </div>
          </div>

          {userFormError && (
            <p className="text-sm text-destructive">{userFormError}</p>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddUser(false);
                setEditUser(null);
                resetUserForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={
                userFormSaving ||
                (!editUser && (!userForm.email || !userForm.password))
              }
            >
              {userFormSaving ? "Saving..." : editUser ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign-on-delete dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setReassignInfo(null);
            setReassignToId("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign records before delete</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong> owns
              records that can't be orphaned. Pick another user to inherit
              their history, then we'll delete the account in one step.
            </DialogDescription>
          </DialogHeader>

          {reassignInfo && (
            <div className="rounded-md border p-3 space-y-1 text-sm">
              {reassignInfo.linked.inventoryItems > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inventory items</span>
                  <span className="font-mono">{reassignInfo.linked.inventoryItems}</span>
                </div>
              )}
              {reassignInfo.linked.scanLogs > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scan log entries</span>
                  <span className="font-mono">{reassignInfo.linked.scanLogs}</span>
                </div>
              )}
              {reassignInfo.linked.cycleCountsCreated > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycle counts created</span>
                  <span className="font-mono">{reassignInfo.linked.cycleCountsCreated}</span>
                </div>
              )}
              {reassignInfo.linked.cycleCountsAssigned > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycle counts assigned</span>
                  <span className="font-mono">{reassignInfo.linked.cycleCountsAssigned}</span>
                </div>
              )}
              {reassignInfo.linked.todos > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To-do items</span>
                  <span className="font-mono">{reassignInfo.linked.todos}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Reassign to</Label>
            <Select value={reassignToId} onValueChange={setReassignToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(u => u.id !== deleteTarget?.id)
                  .map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The new owner will appear as the creator/scanner on all inherited records.
              Approval and &quot;counted by&quot; signatures on individual cycle-count
              events are nulled out (not transferred) to preserve audit accuracy.
            </p>
          </div>

          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setReassignInfo(null); setReassignToId(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReassignDelete}
              disabled={deleting || !reassignToId}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {deleting ? "Reassigning..." : "Reassign & delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
