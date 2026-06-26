"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2Icon, XIcon } from "lucide-react";

interface TableInfo {
  tableNumber: number;
  players: { seatPosition: number; name: string }[];
}

interface SeatDisplayProps {
  tables: {
    tableNumber: number;
    players: {
      seatPosition: number;
      leaguePlayer: { user: { name: string } };
    }[];
  }[];
  roundName: string;
}

function TableCard({ table }: { table: TableInfo }) {
  return (
    <div className="px-5 py-4 rounded-xl border bg-card">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Table {table.tableNumber}
      </div>
      <div className="space-y-0.5">
        {table.players.map((p) => (
          <div key={p.seatPosition} className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {p.seatPosition}°
            </span>
            <span className="text-base font-bold">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableRows({ data }: { data: TableInfo[] }) {
  const rows: TableInfo[][] = [];
  for (let i = 0; i < data.length; i += 3) {
    rows.push(data.slice(i, i + 3));
  }
  return (
    <>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-4 px-8 max-w-6xl mx-auto mb-4">
          {row.map((table) => (
            <TableCard key={table.tableNumber} table={table} />
          ))}
          {row.length < 3 &&
            Array.from({ length: 3 - row.length }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
        </div>
      ))}
    </>
  );
}

export function SeatDisplay({ tables, roundName }: SeatDisplayProps) {
  const [open, setOpen] = useState(false);

  const tableData: TableInfo[] = [...tables]
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .map((t) => ({
      tableNumber: t.tableNumber,
      players: [...t.players]
        .sort((a, b) => a.seatPosition - b.seatPosition)
        .map((p) => ({ seatPosition: p.seatPosition, name: p.leaguePlayer.user.name })),
    }));

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (tableData.length === 0) return null;

  const duration = Math.max(8, (tableData.length / 3) * 4);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Maximize2Icon className="h-3.5 w-3.5" />
        Seats
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />

          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-8 pt-5 pb-3 bg-background/80 backdrop-blur-sm">
            <div>
              <h2 className="text-lg font-bold">{roundName}</h2>
              <p className="text-xs text-muted-foreground">Table assignments — press Esc to close</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <XIcon className="h-5 w-5" />
            </Button>
          </div>

          <div className="absolute inset-0 pt-24 overflow-hidden">
            <div className="flex flex-col animate-seat-scroll" style={{ animationDuration: `${duration}s` }}>
              <TableRows data={tableData} />
              <div className="my-4 mx-auto max-w-6xl w-full px-8"><hr className="border-muted-foreground/30 border-dashed" /></div>
              <TableRows data={tableData} />
              <div className="my-4 mx-auto max-w-6xl w-full px-8"><hr className="border-muted-foreground/30 border-dashed" /></div>
              <TableRows data={tableData} />
              <div className="my-4 mx-auto max-w-6xl w-full px-8"><hr className="border-muted-foreground/30 border-dashed" /></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
