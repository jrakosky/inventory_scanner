"use client";

import { useState, useEffect, useCallback } from "react";
import { User as UserIcon, KeyRound, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MeResponse {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
    createdAt: string;
  };
}

export default function AccountPage() {
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const data: MeResponse = await res.json();
      setUser(data.user);
      setName(data.user?.name || "");
    } catch {}
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const handleSaveName = async () => {
    setNameMessage(null);
    setSavingName(true);
    try {
      const res = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data: MeResponse = await res.json();
        setUser(data.user);
        setNameMessage({ type: "success", text: "Name updated." });
      } else {
        const err = await res.json();
        setNameMessage({ type: "error", text: err.error || "Failed to update" });
      }
    } catch {
      setNameMessage({ type: "error", text: "Network error" });
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "New passwords don't match" });
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwMessage({ type: "success", text: "Password changed." });
      } else {
        const err = await res.json();
        setPwMessage({ type: "error", text: err.error || "Failed to change password" });
      }
    } catch {
      setPwMessage({ type: "error", text: "Network error" });
    }
    setChangingPw(false);
  };

  if (!user) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Profile info */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4 text-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user.email}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <div>
              <Badge variant="secondary">{user.role}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || name === (user.name || "")}
              >
                <Save className="mr-1 h-4 w-4" />
                {savingName ? "Saving..." : "Save"}
              </Button>
            </div>
            {nameMessage && (
              <p className={`text-xs ${nameMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                {nameMessage.type === "success" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                {nameMessage.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Change password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password (min 8 characters)</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              onClick={handleChangePassword}
              disabled={
                changingPw ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword.length < 8
              }
            >
              <KeyRound className="mr-1 h-4 w-4" />
              {changingPw ? "Updating..." : "Update password"}
            </Button>
            {pwMessage && (
              <p className={`text-xs ${pwMessage.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
                {pwMessage.type === "success" && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                {pwMessage.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
