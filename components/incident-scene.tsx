"use client";

import { Float, Grid, Line, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { Vector3 } from "three";
import type { IncidentStatus } from "../lib/types";
import { cn } from "../lib/ui";

const services=[
  {id:"frontend",label:"Frontend",kind:"EDGE",position:[-3,.55,0] as const,screen:[12,43]},
  {id:"gateway",label:"API Gateway",kind:"ROUTING",position:[-1,.55,.08] as const,screen:[37,43]},
  {id:"payment",label:"Payment Service",kind:"CRITICAL",position:[1,.55,.14] as const,screen:[62,43]},
  {id:"database",label:"Payment DB",kind:"DATA",position:[3,.55,0] as const,screen:[87,43]},
  {id:"auth",label:"Auth",kind:"DEPENDENCY",position:[-1.4,-.8,-.05] as const,screen:[32,75]},
  {id:"risk",label:"Risk",kind:"DEPENDENCY",position:[.45,-.8,.08] as const,screen:[55,75]},
  {id:"notifications",label:"Notifications",kind:"ASYNC",position:[2.15,-.8,-.05] as const,screen:[77,75]},
] as const;
const links=[[0,1],[1,2],[2,3],[1,4],[2,5],[2,6]] as const;

function Signal({from,to,color,offset}:{from:readonly [number,number,number];to:readonly [number,number,number];color:string;offset:number}) {
  const signal=useRef<Mesh>(null);
  const start=useMemo(()=>new Vector3(from[0],from[1],from[2]),[from]);
  const end=useMemo(()=>new Vector3(to[0],to[1],to[2]),[to]);
  useFrame(({clock})=>{
    if(!signal.current)return;
    const progress=(clock.elapsedTime*.24+offset)%1;
    signal.current.position.lerpVectors(start,end,progress);
    signal.current.scale.setScalar(.7+Math.sin(clock.elapsedTime*5+offset*8)*.18);
  });
  return <mesh ref={signal}><sphereGeometry args={[.055,16,16]}/><meshBasicMaterial color={color}/></mesh>;
}

function Node({active,incident,recovered,position,index}:{active:boolean;incident:boolean;recovered:boolean;position:readonly [number,number,number];index:number}) {
  const node=useRef<Group>(null);
  const beacon=useRef<Mesh>(null);
  const color=active&&incident?"#ff5c7a":active&&recovered?"#25c58d":"#7a86a6";
  useFrame(({clock})=>{
    if(!node.current)return;
    node.current.rotation.y=Math.sin(clock.elapsedTime*.45+index)*.08;
    if(beacon.current){
      const pulse=active?1+Math.sin(clock.elapsedTime*3)*.11:1;
      beacon.current.scale.setScalar(pulse);
      beacon.current.rotation.z=clock.elapsedTime*.65;
    }
  });
  return <group ref={node} position={position}>
    <Float speed={1.2} rotationIntensity={.08} floatIntensity={.16}>
      <mesh position={[0,-.31,0]} rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.36,.45,.07,32]}/><meshStandardMaterial color="#dce2f1" roughness={.38} metalness={.18}/></mesh>
      <mesh><boxGeometry args={[.5,.38,.26]}/><meshStandardMaterial color={color} emissive={active?color:"#111827"} emissiveIntensity={active ? .75 : .06} roughness={.33} metalness={.18}/></mesh>
      <mesh position={[0,0,.145]}><planeGeometry args={[.26,.12]}/><meshBasicMaterial color="#ffffff" transparent opacity={active?.68:.22}/></mesh>
      {active&&<mesh ref={beacon} rotation={[Math.PI/2,0,0]} position={[0,0,-.02]}><torusGeometry args={[.42,.018,10,48]}/><meshBasicMaterial color={color} transparent opacity={.65}/></mesh>}
    </Float>
  </group>;
}

function TopologyGraph({status,affectedId}:{status:IncidentStatus;affectedId:string}) {
  const group=useRef<Group>(null);
  const incident=status!=="HEALTHY"&&status!=="RESOLVED";
  const recovered=status==="RESOLVED";
  const signalColor=incident?"#ff5c7a":recovered?"#25c58d":"#5b4cf5";
  useFrame(({pointer})=>{
    if(!group.current)return;
    group.current.rotation.y+=(pointer.x*.09-group.current.rotation.y)*.028;
    group.current.rotation.x+=(-pointer.y*.035-group.current.rotation.x)*.028;
  });
  return <group ref={group}>
    {links.map(([from,to],index)=>{
      const touches=services[from].id===affectedId||services[to].id===affectedId;
      const color=incident&&touches?"#ff5c7a":recovered&&touches?"#25c58d":"#b8c2da";
      return <group key={`${from}-${to}`}>
        <Line points={[services[from].position,services[to].position]} color={color} lineWidth={incident&&touches?2.4:1.1} transparent opacity={incident&&touches ? .95 : .72}/>
        <Signal from={services[from].position} to={services[to].position} color={touches?signalColor:"#7694ff"} offset={index*.17}/>
      </group>;
    })}
    {services.map((service,index)=><Node key={service.id} active={service.id===affectedId} incident={incident} recovered={recovered} position={service.position} index={index}/>) }
  </group>;
}

export function IncidentScene({status,service}:{status:IncidentStatus;service:string}) {
  const affectedId=service==="auth-service"?"auth":service==="notification-service"?"notifications":"payment";
  const [selected,setSelected]=useState(affectedId);
  const incident=status!=="HEALTHY"&&status!=="RESOLVED";
  const recovered=status==="RESOLVED";
  const detail=useMemo(()=>services.find(item=>item.id===selected)??services[2],[selected]);
  return <div className="topology upgraded-topology">
    <header className="topology-header"><div><span className="eyebrow">LIVE SERVICE TOPOLOGY</span><h2>Production dependency graph</h2><p>Live request paths and dependency state</p></div><div className="topology-inspector"><span>{detail.kind}</span><b>{detail.label}</b><small>{detail.id===affectedId?(incident?"Correlated failure path":recovered?"Recovery verified":"Operating within baseline"):"Dependency responding normally"}</small></div></header>
    <div className="topology-stage">
      <div className="topology-canvas"><Canvas dpr={[1,1.5]} camera={{position:[0,.05,7.5],fov:37}} gl={{antialias:true,alpha:true,powerPreference:"high-performance"}}>
        <ambientLight intensity={1.45}/><directionalLight position={[3,5,5]} intensity={2.2} color="#e5edff"/><pointLight position={[-3,1,3]} intensity={15} color="#6c5cff" distance={8}/><pointLight position={[3,-1,2]} intensity={12} color={incident?"#ff5c7a":"#36d5a2"} distance={7}/>
        <Grid position={[0,-1.35,-.38]} args={[8.5,4.1]} cellSize={.45} cellThickness={.55} cellColor="#d8deee" sectionSize={1.8} sectionThickness={.9} sectionColor="#b9c4e2" fadeDistance={8} fadeStrength={1.2} infiniteGrid/>
        <Sparkles count={22} scale={[7,2.8,1.4]} size={1.6} speed={.15} opacity={.35} color="#6f78f7"/>
        <TopologyGraph status={status} affectedId={affectedId}/>
      </Canvas></div>
      <div className="service-labels">{services.map(item=>{const isAffected=item.id===affectedId;return <button key={item.id} style={{left:`${item.screen[0]}%`,top:`${item.screen[1]}%`}} onClick={()=>setSelected(item.id)} className={cn(selected===item.id&&"selected",isAffected&&incident&&"affected",isAffected&&recovered&&"recovered")}><i/><span><b>{item.label}</b><small>{item.kind}</small></span></button>})}</div>
    </div>
    <footer><span><i className="healthy"/>Healthy dependency</span><span><i className={incident?"affected":"recovered"}/>{incident?"Correlated failure path":"Verified path"}</span><span>Animated signals show request flow · select any service to inspect</span></footer>
  </div>;
}
