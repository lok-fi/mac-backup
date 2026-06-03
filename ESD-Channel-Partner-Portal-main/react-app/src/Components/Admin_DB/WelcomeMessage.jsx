import React, { useEffect, useRef } from "react";
import gsap from "gsap";

const WelcomeMessage = () => {
  const flowRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const ctx = gsap.context(() => {
      const allCapsules = flowRef.current.querySelectorAll(".capsule-item");

      // 1. Track Mouse Position relative to the flow container
      const handleMouseMove = (e) => {
        const rect = flowRef.current.getBoundingClientRect();
        mouseRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
      };

      // 2. The Main Animation Loop
      allCapsules.forEach((cap, i) => {
        const laneIndex = Math.floor(i / 3);
        const verticalGap = 55;
        const verticalPos = laneIndex * verticalGap;
        const isEvenLane = laneIndex % 2 === 0;

        gsap.set(cap, {
          x: -120,
          y: verticalPos + 10,
          opacity: 0,
          rotate: -35,
        });

        const mainAnim = gsap.to(cap, {
          x: 750,
          y: verticalPos - 350,
          duration: 7,
          repeat: -1,
          ease: "none",
          delay: ((i % 3) * 2.3) + (isEvenLane ? 1.15 : 0),
          onStart: function() {
            gsap.to(this.targets(), { opacity: 1, duration: 0.5 });
          },
          // 3. Collision Detection: Runs every frame
          onUpdate: function() {
            const target = this.targets()[0];
            const capX = gsap.getProperty(target, "x");
            const capY = gsap.getProperty(target, "y");

            // Calculate distance between mouse and capsule center
            const dx = capX - mouseRef.current.x;
            const dy = capY - mouseRef.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 4. Interaction: If within 50px radius, turn border Gold
            if (distance < 80) {
              gsap.to(target, { 
                borderColor: "#FFD700", 
                borderWidth: "3px", 
                scale: 1.1,
                duration: 0.2,
                overwrite: "auto" 
              });
            } else {
              // Return to original state (Solid Orange or White/Orange)
              const isSolid = (laneIndex + (i % 3)) % 2 === 0;
              gsap.to(target, { 
                borderColor: isSolid ? "transparent" : "#f97316", 
                borderWidth: isSolid ? "0px" : "2px",
                scale: 1,
                duration: 0.4,
                overwrite: "auto"
              });
            }
          }
        });
      });

      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    });
    return () => ctx.revert();
  }, []);

  const lanes = [0, 1, 2, 3, 4, 5, 6,7,8,9];

  return (
    <div className="h-64 w-full py-4 font-sans">
      <div className="h-full w-full rounded-3xl relative overflow-hidden bg-white flex items-center border border-slate-200 shadow-xl">
        
        {/* LEFT TEXT */}
        <div className="z-30 pl-12 w-1/2">
          <h1 className="text-4xl font-black text-slate-900 leading-tight">
            Welcome back, <br />
            <span className="text-orange-500 font-serif italic">Lok1 Online</span>
          </h1>
          <p className="text-slate-400 mt-2 italic text-sm font-medium">
            "Real estate management made simple."
          </p>
        </div>

        {/* CLIPPING CONTAINER */}
        <div className="absolute top-0 right-0 w-[45%] h-full bg-[#FFFBF7] -skew-x-12 translate-x-20 z-10 border-l-2 border-orange-100 overflow-hidden">
          
          <div ref={flowRef} className="absolute inset-0 pointer-events-none skew-x-12 -translate-x-10">
            {lanes.map((lane) => (
              <React.Fragment key={lane}>
                {[0, 1, 2].map((capIndex) => {
                  const isSolid = (lane + capIndex) % 2 === 0;
                  const baseStyle = isSolid 
                    ? "bg-orange-500 border-transparent" 
                    : "bg-white border-2 border-orange-500";
                  
                  return (
                    <div 
                      key={capIndex}
                      className={`capsule-item absolute w-20 h-7 rounded-full shadow-sm transition-colors ${baseStyle}`} 
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* GREETING */}
        <div className="absolute bottom-10 right-16 z-40 bg-white px-5 py-2 rounded-2xl shadow-2xl border border-orange-100 font-black text-orange-600">
          Hi! 👋
        </div>
      </div>
    </div>
  );
};

export default WelcomeMessage;