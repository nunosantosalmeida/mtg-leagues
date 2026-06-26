"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  createdAt: string;
  _count: { leaguesCreated: number; leaguePlayers: number };
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, router]);

  function fetchUsers() {
    fetch("/api/admin/users")
      .then((res) => {
        if (!res.ok) {
          setError("You are not an admin");
          setLoading(false);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setLoading(false);
      });
  }

  async function handleCreatePlayer(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || "Failed to create player");
        return;
      }

      setCreateSuccess(`Player "${data.name}" (${data.email}) registered. They can now log in with Google.`);
      setNewName("");
      setNewEmail("");
      fetchUsers();
    } catch {
      setCreateError("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === "ADMIN" ? "PLAYER" : "ADMIN";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      }
    } catch {
      alert("Failed to update user");
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => router.push("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <p className="text-muted-foreground mb-8">Manage users, register players, and assign roles</p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Register Player</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Register a player by their Google email. They can then log in with Google and will be linked to this account.
          </p>
          <form onSubmit={handleCreatePlayer} className="flex flex-col gap-4 max-w-lg">
            {createError && (
              <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">{createError}</div>
            )}
            {createSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">{createSuccess}</div>
            )}
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="playerName">Name</Label>
                <Input
                  id="playerName"
                  placeholder="Player name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="playerEmail">Google Email</Label>
                <Input
                  id="playerEmail"
                  type="email"
                  placeholder="player@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Button type="submit" disabled={creating}>
                {creating ? "Registering..." : "Register Player"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead className="text-center">Leagues</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.provider}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {user._count.leaguePlayers}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdmin(user.id, user.role)}
                    >
                      {user.role === "ADMIN" ? "Revoke Admin" : "Make Admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
