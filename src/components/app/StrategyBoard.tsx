import { useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2,
  Pencil,
  Eraser,
  Plus,
  Circle,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
  Download,
  Play,
  RotateCcw,
  Trash2,
  ArrowUpRight,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Court dimensions (SVG units). 13.4m x 6.1m, scaled.
const W = 610;
const H = 1340;

type Tool = "select" | "shot" | "move" | "free" | "erase";
type Player = { id: string; team: "blue" | "red"; n: number; name: string; x: number; y: number };
type Shuttle = { x: number; y: number };
type Arrow = { id: string; kind: "shot" | "move"; x1: number; y1: number; x2: number; y2: number };
type FreePath = { id: string; d: string };
type BoardState = {
  players: Player[];
  shuttle: Shuttle;
  arrows: Arrow[];
  paths: FreePath[];
  mode: "singles" | "doubles";
};

const initial = (): BoardState => ({
  mode: "doubles",
  players: [
    { id: "b1", team: "blue", n: 1, name: "B1", x: W * 0.3, y: H * 0.78 },
    { id: "b2", team: "blue", n: 2, name: "B2", x: W * 0.7, y: H * 0.78 },
    { id: "r1", team: "red", n: 1, name: "R1", x: W * 0.3, y: H * 0.22 },
    { id: "r2", team: "red", n: 2, name: "R2", x: W * 0.7, y: H * 0.22 },
  ],
  shuttle: { x: W / 2, y: H / 2 },
  arrows: [],
  paths: [],
});

const uid = () => Math.random().toString(36).slice(2, 10);

export function StrategyBoard() {
  const { user } = useAuth();
  const [state, setState] = useState<BoardState>(initial);
  const [tool, setTool] = useState<Tool>("select");
  const [history, setHistory] = useState<BoardState[]>([]);
  const [future, setFuture] = useState<BoardState[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [strategies, setStrategies] = useState<Array<{ id: string; name: string; data: BoardState; user_id: string }>>([]);
  const [openLoad, setOpenLoad] = useState(false);
  const [openSave, setOpenSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawingRef = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const freeRef = useRef<{ id: string; points: string[] } | null>(null);
  const dragRef = useRef<{ kind: "player" | "shuttle"; id?: string } | null>(null);

  const pushHistory = (next: BoardState) => {
    setHistory((h) => [...h.slice(-49), state]);
    setFuture([]);
    setState(next);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [state, ...f]);
      setState(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, state]);
      setState(next);
      return f.slice(1);
    });
  };

  const svgPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // ===== Background pointer handlers (draw / freehand / erase by clicking element handled separately) =====
  const onBgPointerDown = (e: React.PointerEvent) => {
    if (playing) return;
    if (tool === "select") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = svgPoint(e);
    if (tool === "shot" || tool === "move") {
      const id = uid();
      drawingRef.current = { id, startX: x, startY: y };
      setState((s) => ({
        ...s,
        arrows: [...s.arrows, { id, kind: tool, x1: x, y1: y, x2: x, y2: y }],
      }));
    } else if (tool === "free") {
      const id = uid();
      freeRef.current = { id, points: [`M ${x} ${y}`] };
      setState((s) => ({ ...s, paths: [...s.paths, { id, d: `M ${x} ${y}` }] }));
    }
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current && !freeRef.current && !dragRef.current) return;
    const { x, y } = svgPoint(e);
    if (drawingRef.current) {
      const id = drawingRef.current.id;
      setState((s) => ({
        ...s,
        arrows: s.arrows.map((a) => (a.id === id ? { ...a, x2: x, y2: y } : a)),
      }));
    } else if (freeRef.current) {
      const f = freeRef.current;
      f.points.push(`L ${x} ${y}`);
      const d = f.points.join(" ");
      setState((s) => ({
        ...s,
        paths: s.paths.map((p) => (p.id === f.id ? { ...p, d } : p)),
      }));
    } else if (dragRef.current) {
      const d = dragRef.current;
      const cx = Math.max(20, Math.min(W - 20, x));
      const cy = Math.max(20, Math.min(H - 20, y));
      if (d.kind === "shuttle") {
        setState((s) => ({ ...s, shuttle: { x: cx, y: cy } }));
      } else if (d.kind === "player" && d.id) {
        setState((s) => ({
          ...s,
          players: s.players.map((p) => (p.id === d.id ? { ...p, x: cx, y: cy } : p)),
        }));
      }
    }
  };
  const onBgPointerUp = () => {
    if (drawingRef.current || freeRef.current) {
      // commit one history entry per stroke
      setHistory((h) => [...h.slice(-49), state]);
      setFuture([]);
    }
    drawingRef.current = null;
    freeRef.current = null;
    dragRef.current = null;
  };

  // ===== Add/remove players/shuttle =====
  const addPlayer = (team: "blue" | "red") => {
    const count = state.players.filter((p) => p.team === team).length;
    const n = count + 1;
    const x = team === "blue" ? W * (0.3 + 0.15 * count) : W * (0.3 + 0.15 * count);
    const y = team === "blue" ? H * 0.85 : H * 0.15;
    pushHistory({
      ...state,
      players: [...state.players, { id: uid(), team, n, name: `${team === "blue" ? "B" : "R"}${n}`, x, y }],
    });
  };
  const resetBoard = () => pushHistory(initial());
  const clearDrawings = () => pushHistory({ ...state, arrows: [], paths: [] });

  // ===== Element click for erase =====
  const eraseArrow = (id: string) => {
    if (tool !== "erase") return;
    pushHistory({ ...state, arrows: state.arrows.filter((a) => a.id !== id) });
  };
  const erasePath = (id: string) => {
    if (tool !== "erase") return;
    pushHistory({ ...state, paths: state.paths.filter((a) => a.id !== id) });
  };
  const removePlayer = (id: string) => {
    if (tool !== "erase") return;
    pushHistory({ ...state, players: state.players.filter((p) => p.id !== id) });
  };

  // ===== Animation along arrows =====
  const [animState, setAnimState] = useState<BoardState | null>(null);
  useEffect(() => {
    if (!playing) {
      setAnimState(null);
      return;
    }
    const start = performance.now();
    const duration = 2200 / speed;
    let raf = 0;
    const moveArrows = state.arrows.filter((a) => a.kind === "move");
    const shotArrows = state.arrows.filter((a) => a.kind === "shot");
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // move players whose starting position is near a move arrow's tail
      const players = state.players.map((p) => {
        const arrow = moveArrows.find(
          (a) => Math.hypot(a.x1 - p.x, a.y1 - p.y) < 50,
        );
        if (!arrow) return p;
        return {
          ...p,
          x: arrow.x1 + (arrow.x2 - arrow.x1) * t,
          y: arrow.y1 + (arrow.y2 - arrow.y1) * t,
        };
      });
      let shuttle = state.shuttle;
      const firstShot = shotArrows[0];
      if (firstShot) {
        shuttle = {
          x: firstShot.x1 + (firstShot.x2 - firstShot.x1) * t,
          y: firstShot.y1 + (firstShot.y2 - firstShot.y1) * t,
        };
      }
      setAnimState({ ...state, players, shuttle });
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, state]);

  const view = animState ?? state;

  // ===== Supabase save/load =====
  const loadStrategies = async () => {
    const { data, error } = await supabase
      .from("strategies")
      .select("id,name,data,user_id")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setStrategies((data as never) ?? []);
  };
  useEffect(() => {
    if (openLoad) loadStrategies();
  }, [openLoad]);

  const saveStrategy = async () => {
    if (!user) return toast.error("Sign in to save");
    if (!saveName.trim()) return toast.error("Name required");
    const { error } = await supabase
      .from("strategies")
      .insert({ name: saveName.trim(), data: state as never, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Strategy saved");
    setOpenSave(false);
    setSaveName("");
  };
  const loadOne = (s: { data: BoardState }) => {
    pushHistory(s.data);
    setOpenLoad(false);
    toast.success("Loaded");
  };
  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("strategies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setStrategies((arr) => arr.filter((s) => s.id !== id));
  };

  // ===== Export PNG =====
  const exportPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "strategy.png";
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = "data:image/svg+xml;base64," + svg64;
  };

  const tools: Array<{ id: Tool; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "shot", icon: ArrowUpRight, label: "Shot" },
    { id: "move", icon: Move, label: "Move" },
    { id: "free", icon: Pencil, label: "Draw" },
    { id: "erase", icon: Eraser, label: "Erase" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Strategy Board</h1>
          <p className="text-xs text-muted-foreground">Plan rallies, drag players, draw shots.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur px-2 py-2 flex flex-wrap items-center gap-1 sticky top-14 z-30">
        {tools.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tool === t.id ? "default" : "ghost"}
            className="h-9 px-2.5 rounded-xl"
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline ml-1 text-xs">{t.label}</span>
          </Button>
        ))}
        <div className="w-px h-6 bg-border/60 mx-1" />
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={() => addPlayer("blue")} title="Add blue player">
          <Plus className="w-4 h-4" /><span className="w-2 h-2 rounded-full bg-sky-500 ml-1" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={() => addPlayer("red")} title="Add red player">
          <Plus className="w-4 h-4" /><span className="w-2 h-2 rounded-full bg-rose-500 ml-1" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={() => pushHistory({ ...state, shuttle: { x: W / 2, y: H / 2 } })} title="Reset shuttle">
          <Circle className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border/60 mx-1" />
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={undo} disabled={!history.length} title="Undo">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={redo} disabled={!future.length} title="Redo">
          <Redo2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={clearDrawings} title="Clear drawings">
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={resetBoard} title="Reset board">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border/60 mx-1" />
        <Button size="sm" variant={playing ? "default" : "ghost"} className="h-9 rounded-xl" onClick={() => setPlaying((p) => !p)} title="Play animation">
          <Play className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 px-2 w-32">
          <span className="text-[10px] text-muted-foreground">Speed</span>
          <Slider value={[speed]} min={0.5} max={3} step={0.1} onValueChange={(v) => setSpeed(v[0])} />
        </div>
        <div className="w-px h-6 bg-border/60 mx-1" />

        <Dialog open={openSave} onOpenChange={setOpenSave}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 rounded-xl" title="Save">
              <Save className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Save strategy</DialogTitle></DialogHeader>
            <Input placeholder="Strategy name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <Button onClick={saveStrategy}>Save</Button>
          </DialogContent>
        </Dialog>

        <Dialog open={openLoad} onOpenChange={setOpenLoad}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 rounded-xl" title="Load">
              <FolderOpen className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Saved strategies</DialogTitle></DialogHeader>
            <div className="space-y-1 max-h-80 overflow-auto">
              {strategies.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border/60">
                  <button className="text-sm flex-1 text-left hover:text-primary" onClick={() => loadOne(s)}>{s.name}</button>
                  {s.user_id === user?.id && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteOne(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" variant="ghost" className="h-9 rounded-xl" onClick={exportPng} title="Export PNG">
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Court */}
      <div className="rounded-2xl overflow-hidden border border-border/60 bg-[#0b3d22] shadow-lg">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full h-auto touch-none select-none"
          style={{ maxHeight: "75vh" }}
          onPointerDown={onBgPointerDown}
          onPointerMove={onBgPointerMove}
          onPointerUp={onBgPointerUp}
          onPointerCancel={onBgPointerUp}
        >
          <defs>
            <marker id="arrowYellow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#facc15" />
            </marker>
            <marker id="arrowBlack" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#0a0a0a" />
            </marker>
          </defs>

          {/* Court surface */}
          <rect x="0" y="0" width={W} height={H} fill="#0f6b3a" />
          <rect x="40" y="40" width={W - 80} height={H - 80} fill="#15914d" />
          {/* Outer doubles */}
          <rect x="40" y="40" width={W - 80} height={H - 80} fill="none" stroke="#fff" strokeWidth="4" />
          {/* Singles sidelines */}
          <line x1="80" y1="40" x2="80" y2={H - 40} stroke="#fff" strokeWidth="3" />
          <line x1={W - 80} y1="40" x2={W - 80} y2={H - 40} stroke="#fff" strokeWidth="3" />
          {/* Net */}
          <line x1="40" y1={H / 2} x2={W - 40} y2={H / 2} stroke="#fff" strokeWidth="4" strokeDasharray="6 6" />
          {/* Short service lines */}
          <line x1="40" y1={H / 2 - 100} x2={W - 40} y2={H / 2 - 100} stroke="#fff" strokeWidth="3" />
          <line x1="40" y1={H / 2 + 100} x2={W - 40} y2={H / 2 + 100} stroke="#fff" strokeWidth="3" />
          {/* Long service line for doubles */}
          <line x1="40" y1="120" x2={W - 40} y2="120" stroke="#fff" strokeWidth="3" />
          <line x1="40" y1={H - 120} x2={W - 40} y2={H - 120} stroke="#fff" strokeWidth="3" />
          {/* Center line in service boxes */}
          <line x1={W / 2} y1="40" x2={W / 2} y2={H / 2 - 100} stroke="#fff" strokeWidth="3" />
          <line x1={W / 2} y1={H / 2 + 100} x2={W / 2} y2={H - 40} stroke="#fff" strokeWidth="3" />

          {/* Free paths */}
          {view.paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke="#fde047"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={(e) => {
                if (tool === "erase") { e.stopPropagation(); erasePath(p.id); }
              }}
              style={{ cursor: tool === "erase" ? "pointer" : "default" }}
            />
          ))}

          {/* Arrows */}
          {view.arrows.map((a) => {
            const dx = a.x2 - a.x1;
            const dy = a.y2 - a.y1;
            const mx = (a.x1 + a.x2) / 2;
            const my = (a.y1 + a.y2) / 2;
            // curve perpendicular for shots
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const curve = a.kind === "shot" ? 40 : 0;
            const cx = mx + nx * curve;
            const cy = my + ny * curve;
            const d = a.kind === "shot"
              ? `M ${a.x1} ${a.y1} Q ${cx} ${cy} ${a.x2} ${a.y2}`
              : `M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`;
            return (
              <path
                key={a.id}
                d={d}
                fill="none"
                stroke={a.kind === "shot" ? "#facc15" : "#0a0a0a"}
                strokeWidth={a.kind === "move" ? 4 : 5}
                strokeDasharray={a.kind === "move" ? "10 6" : undefined}
                markerEnd={a.kind === "shot" ? "url(#arrowYellow)" : "url(#arrowBlack)"}
                strokeLinecap="round"
                onPointerDown={(e) => {
                  if (tool === "erase") { e.stopPropagation(); eraseArrow(a.id); }
                }}
                style={{ cursor: tool === "erase" ? "pointer" : "default" }}
              />
            );
          })}

          {/* Players */}
          {view.players.map((p) => (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              style={{ cursor: tool === "select" ? "grab" : tool === "erase" ? "pointer" : "default" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (tool === "erase") { removePlayer(p.id); return; }
                if (tool !== "select") return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                dragRef.current = { kind: "player", id: p.id };
              }}
              onPointerMove={onBgPointerMove}
              onPointerUp={onBgPointerUp}
            >
              <circle r="28" fill={p.team === "blue" ? "#0ea5e9" : "#ef4444"} stroke="#fff" strokeWidth="3" />
              <text textAnchor="middle" dy="6" fill="#fff" fontSize="22" fontWeight="700">{p.n}</text>
              <text textAnchor="middle" y="48" fill="#fff" fontSize="14" fontWeight="600" style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>
                {p.name}
              </text>
            </g>
          ))}

          {/* Shuttle */}
          <g
            transform={`translate(${view.shuttle.x} ${view.shuttle.y})`}
            style={{ cursor: tool === "select" ? "grab" : "default" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (tool !== "select") return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragRef.current = { kind: "shuttle" };
            }}
            onPointerMove={onBgPointerMove}
            onPointerUp={onBgPointerUp}
          >
            <circle r="12" fill="#ffffff" stroke="#111" strokeWidth="2" />
            <path d="M -8 -2 L 0 -14 L 8 -2 Z" fill="#fff" stroke="#111" strokeWidth="1.5" />
          </g>
        </svg>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Tip: pick Shot or Move and drag on the court to draw. Use Select to drag players and the shuttle. Press Play to animate.
      </div>
    </div>
  );
}

// satisfy cn import even if unused inline
void cn;