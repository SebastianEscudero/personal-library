"use client";

import { useState, useCallback, useRef, useEffect, useSyncExternalStore, useMemo } from "react";

// Helper to extract YouTube video ID from various URL formats
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fragment data - each represents a piece of wisdom on the workbench
// Options: tape: true (adds tape at top), pin: true (adds red pushpin)
const fragments = [
  // Row 1
  { id: 11, type: "manila", text: "In the midst of chaos, there is also opportunity.", author: "Sun Tzu", top: "2%", left: "5%", width: "240px", rotate: 2.5, z: 6 },
  { id: 18, type: "aged-paper", text: "Now, with God's help, I shall become myself.", author: "Søren Kierkegaard", top: "3%", right: "5%", width: "280px", rotate: -1.5, z: 6, tape: true },
  // Row 2
  { id: 19, type: "typewriter", text: "The world belongs to the energetic.", author: "Ralph Waldo Emerson", top: "16%", left: "5%", width: "240px", rotate: 1.2, z: 5 },
  { id: 13, type: "media", title: "Michael Jordan's Wisdom", url: "https://www.youtube.com/watch?v=EUo0ncJX19A", top: "18%", right: "5%", width: "180px", rotate: -2.5, z: 10 },
  // Row 3
  { id: 22, type: "notebook", text: "There's no greater danger than playing it safe.", top: "32%", left: "5%", width: "220px", rotate: 1.5, z: 6 },
  // Row 4 - larger cards
  { id: 20, type: "legal-pad", text: "Here's to the crazy ones. The misfits. The rebels. The troublemakers. The round pegs in the square holes. The ones who see things differently. They're not fond of rules. And they have no respect for the status quo. You can quote them, disagree with them, glorify or vilify them. About the only thing you can't do is ignore them. Because they change things. They push the human race forward. And while some may see them as the crazy ones, we see genius. Because the people who are crazy enough to think they can change the world, are the ones who do.", author: "Steve Jobs", top: "44%", left: "3%", width: "320px", rotate: 0.8, z: 7, tape: true, fontSize: "1rem" },
  { id: 21, type: "torn-scrap", text: "You are not your job. You're not how much money you have in the bank. You're not the car you drive. You're not the contents of your wallet. You're not your fucking khakis.", author: "Tyler Durden", top: "46%", right: "5%", width: "300px", rotate: -2, z: 8, pin: true },
];

type Fragment = (typeof fragments)[number];
type Position = { x: number; y: number };

// Persisted layout store
type LayoutData = { positions: Record<number, Position>; zIndexes: Record<number, number>; maxZ: number };

const layoutStore = (() => {
  const listeners = new Set<() => void>();
  let data: LayoutData | null = null;
  let isLoaded = false;
  let snapshot = { data, isLoaded };
  const serverSnapshot = { data: null, isLoaded: false };

  if (typeof window !== "undefined") {
    try { data = JSON.parse(localStorage.getItem("library-layout") || "null"); } catch {}
    isLoaded = true;
    snapshot = { data, isLoaded };
  }

  return {
    subscribe: (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    save: (newData: LayoutData) => {
      try {
        localStorage.setItem("library-layout", JSON.stringify(newData));
        data = newData;
        snapshot = { data, isLoaded };
        listeners.forEach(cb => cb());
      } catch {}
    },
  };
})();

function useLayout() {
  const { data, isLoaded } = useSyncExternalStore(layoutStore.subscribe, layoutStore.getSnapshot, layoutStore.getServerSnapshot);
  return { layout: data, isLoaded, saveLayout: layoutStore.save };
}

// Map fragment types to CSS classes
const typeClasses: Record<string, string> = {
  "legal-pad": "legal-pad",
  "notebook": "notebook",
  "torn-scrap": "torn-scrap",
  "aged-paper": "aged-paper",
  "typewriter": "typewriter-paper",
  "manila": "manila-card",
  "media": "media-card",
};

export default function Library() {
  // Persisted positions
  const { layout, isLoaded, saveLayout } = useLayout();
  const positions = useMemo(() => layout?.positions ?? {}, [layout]);
  const zIndexes = useMemo(() => layout?.zIndexes ?? {}, [layout]);

  // Focus state
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [focusOrigin, setFocusOrigin] = useState<Position | null>(null);
  const [focusPhase, setFocusPhase] = useState<"idle" | "opening" | "open" | "closing">("idle");

  // Drag state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<Position | null>(null);

  // Refs
  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number } | null>(null);
  const didDragRef = useRef(false);
  const maxZRef = useRef(layout?.maxZ ?? 20);

  const persistLayout = useCallback((newPositions: Record<number, Position>, newZIndexes: Record<number, number>, newMaxZ: number) => {
    maxZRef.current = newMaxZ;
    saveLayout({ positions: newPositions, zIndexes: newZIndexes, maxZ: newMaxZ });
  }, [saveLayout]);

  // Handle drag move/end
  useEffect(() => {
    if (draggingId === null) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (dragStartRef.current) {
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
        setDragPos({ x: dragStartRef.current.elemX + dx, y: dragStartRef.current.elemY + dy });
      }
    };

    const handleEnd = () => {
      if (draggingId !== null && dragPos) {
        const newMaxZ = maxZRef.current + 1;
        const newPositions = { ...positions, [draggingId]: dragPos };
        const newZIndexes = { ...zIndexes, [draggingId]: newMaxZ };
        persistLayout(newPositions, newZIndexes, newMaxZ);
      }
      setDraggingId(null);
      setDragPos(null);
      dragStartRef.current = null;
    };

    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [draggingId, dragPos, positions, zIndexes, persistLayout]);

  // Start dragging
  const handlePointerDown = useCallback((id: number, e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    didDragRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY, elemX: rect.left, elemY: rect.top };
    setDraggingId(id);
    setDragPos({ x: rect.left, y: rect.top });

    const newMaxZ = maxZRef.current + 1;
    const newZIndexes = { ...zIndexes, [id]: newMaxZ };
    persistLayout(positions, newZIndexes, newMaxZ);
  }, [positions, zIndexes, persistLayout]);

  // Handle click to focus/unfocus
  const handleClick = useCallback((id: number, rect: DOMRect) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    if (focusedId === id) {
      // Unfocus: animate back to origin
      setFocusPhase("closing");
      setTimeout(() => {
        setFocusedId(null);
        setFocusOrigin(null);
        setFocusPhase("idle");
      }, 450);
    } else {
      // Focus: capture position and animate to center
      setFocusOrigin({ x: rect.left, y: rect.top });
      setFocusedId(id);
      setFocusPhase("opening");
      requestAnimationFrame(() => setFocusPhase("open"));
    }
  }, [focusedId]);

  // Close via overlay click
  const closeFocus = useCallback(() => {
    if (focusedId !== null) {
      setFocusPhase("closing");
      setTimeout(() => {
        setFocusedId(null);
        setFocusOrigin(null);
        setFocusPhase("idle");
      }, 450);
    }
  }, [focusedId]);

  // Compute styles for each fragment
  const getStyle = (item: Fragment, isFocused: boolean, isDragging: boolean, customPos?: Position): React.CSSProperties => {
    const currentZ = zIndexes[item.id] || item.z;
    const isMedia = item.type === "media";

    // Focused states
    if (isFocused && focusOrigin) {
      const transition = "top 0.45s cubic-bezier(0.4, 0, 0.2, 1), left 0.45s cubic-bezier(0.4, 0, 0.2, 1), transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), width 0.45s cubic-bezier(0.4, 0, 0.2, 1)";

      if (focusPhase === "open") {
        // Media cards: use larger width instead of scale (so video controls stay normal)
        // Other cards: use scale
        return {
          position: "fixed",
          top: "50%",
          left: "50%",
          right: "auto",
          transform: isMedia
            ? "translate(-50%, -50%) rotate(0deg)"
            : "translate(-50%, -50%) rotate(0deg) scale(1.5)",
          zIndex: 1001,
          width: isMedia ? "480px" : item.width,
          transition,
        };
      } else {
        // opening or closing - at origin position
        return {
          position: "fixed",
          top: focusOrigin.y,
          left: focusOrigin.x,
          right: "auto",
          transform: `rotate(${item.rotate}deg) scale(1)`,
          zIndex: 1001,
          width: item.width,
          transition: focusPhase === "closing" ? transition : "none",
        };
      }
    }

    // Dragging
    if (isDragging && dragPos) {
      return {
        position: "fixed",
        top: dragPos.y,
        left: dragPos.x,
        right: "auto",
        width: item.width,
        zIndex: 999,
        transform: `rotate(${item.rotate * 0.3}deg) scale(1.02)`,
        cursor: "grabbing",
      };
    }

    // After drag (custom position)
    if (customPos) {
      return {
        position: "fixed",
        top: customPos.y,
        left: customPos.x,
        right: "auto",
        width: item.width,
        zIndex: currentZ,
        transform: `rotate(${item.rotate}deg)`,
      };
    }

    // Default position
    return {
      top: item.top,
      left: item.left,
      right: item.right,
      width: item.width,
      zIndex: currentZ,
      transform: `rotate(${item.rotate}deg)`,
    };
  };

  // Render media card content
  const renderMediaCard = (item: Fragment, isFocused: boolean, isFullyOpen: boolean) => {
    const videoId = item.url ? getYouTubeId(item.url) : null;
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

    // Show embedded player when focused
    if (isFocused && isFullyOpen && videoId) {
      return (
        <div className="media-embed">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <div className="media-info">
            <div className="title">{item.title}</div>
            <div className="author">{item.author}</div>
          </div>
        </div>
      );
    }

    // Show thumbnail
    return (
      <>
        <div className="media-placeholder" style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}>
          <div className="play-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        <div className="title">{item.title}</div>
        <div className="author">{item.author}</div>
      </>
    );
  };

  return (
    <div className="workshop">
      <div
        className={`focus-overlay ${focusPhase === "open" ? "active" : ""}`}
        onClick={closeFocus}
      />

      <div className="workbench">
        {isLoaded && fragments.map((item) => {
          const isDragging = draggingId === item.id;
          const isFocused = focusedId === item.id;
          const isFullyOpen = isFocused && focusPhase === "open";
          const customPos = positions[item.id];

          const classes = [
            "fragment",
            typeClasses[item.type],
            item.tape && "has-tape",
            item.pin && "has-pin",
            isDragging && "dragging",
            isFocused && "focused",
          ].filter(Boolean).join(" ");

          return (
            <div
              key={item.id}
              className={classes}
              style={{ ...getStyle(item, isFocused, isDragging, customPos), ...(item.fontSize && { fontSize: item.fontSize }) }}
              onMouseDown={(e) => !isFocused && handlePointerDown(item.id, e, e.currentTarget.getBoundingClientRect())}
              onTouchStart={(e) => !isFocused && handlePointerDown(item.id, e, e.currentTarget.getBoundingClientRect())}
              onClick={(e) => handleClick(item.id, e.currentTarget.getBoundingClientRect())}
            >
              {item.type === "media" ? (
                renderMediaCard(item, isFocused, isFullyOpen)
              ) : (
                <>
                  {item.text}
                  {item.author && <div className="attribution">— {item.author}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
