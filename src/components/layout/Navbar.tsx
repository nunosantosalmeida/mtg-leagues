"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-primary">MTG</span>{" "}
            <span className="text-muted-foreground font-medium">Leagues</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/leagues"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive("/leagues")
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            Leagues
          </Link>

          <ThemeToggle />

          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="ml-1 relative h-8 w-8 rounded-full inline-flex items-center justify-center hover:bg-muted cursor-pointer transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs font-medium">
                    {session.user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52" align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium leading-none">{session.user?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{session.user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/profile" className="cursor-pointer w-full" />}
                >
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link href="/leagues" className="cursor-pointer w-full" />}
                >
                  My Leagues
                </DropdownMenuItem>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(session.user as any)?.role === "ADMIN" && (
                  <DropdownMenuItem
                    render={<Link href="/admin" className="cursor-pointer w-full" />}
                  >
                    Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1.5 ml-1">
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
