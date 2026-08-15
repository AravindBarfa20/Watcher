"use client";

import { Line } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
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

function TopologyGraph({status,affectedId}:{status:IncidentStatus;affectedId:string}) {
  const group=useRef<Group>(null);const incident=status!=="HEALTHY"&&status!=="RESOLVED";const recovered=status==="RESOLVED";
  useFrame(({pointer})=>{if(!group.current)return;group.current.rotation.y+=(pointer.x*.018-group.current.rotation.y)*.035;group.current.rotation.x+=(-pointer.y*.012-group.current.rotation.x)*.035});
  return <group ref={group}>{links.map(([from,to],index)=>{const touches=services[from].id===affectedId||services[to].id===affectedId;return <Line key={index} points={[services[from].position,services[to].position]} color={incident&&touches?"#a43f3d":recovered&&touches?"#347d60":"#333841"} lineWidth={incident&&touches?2:1.2}/>})}{services.map(service=><Node key={service.id} active={service.id===affectedId} incident={incident} recovered={recovered} position={service.position}/>)}</group>;
}

function Node({active,incident,recovered,position}:{active:boolean;incident:boolean;recovered:boolean;position:readonly [number,number,number]}) {
  const mesh=useRef<Mesh>(null);useFrame(({clock})=>{if(mesh.current&&active&&incident){const value=1+Math.sin(clock.elapsedTime*3)*.055;mesh.current.scale.setScalar(value)}});const color=active&&incident?"#ef5350":active&&recovered?"#4ac18e":"#778090";
  return <group position={position}><mesh ref={mesh}><boxGeometry args={[.48,.38,.24]}/><meshStandardMaterial color={color} emissive={active?color:"#000"} emissiveIntensity={active ? .7 : 0} roughness={.48}/></mesh>{active&&<mesh scale={1.35}><boxGeometry args={[.48,.38,.24]}/><meshBasicMaterial color={color} transparent opacity={.08}/></mesh>}</group>;
}

export function IncidentScene({status,service}:{status:IncidentStatus;service:string}) {
  const affectedId=service==="auth-service"?"auth":service==="notification-service"?"notifications":"payment";const [selected,setSelected]=useState(affectedId);const incident=status!=="HEALTHY"&&status!=="RESOLVED";const recovered=status==="RESOLVED";const detail=useMemo(()=>services.find(item=>item.id===selected)??services[2],[selected]);
  return <div className="topology upgraded-topology"><header className="topology-header"><div><span className="eyebrow">LIVE SERVICE TOPOLOGY</span><h2>Production dependency graph</h2></div><div className="topology-inspector"><span>{detail.kind}</span><b>{detail.label}</b><small>{detail.id===affectedId?(incident?"Correlated failure path":recovered?"Recovery verified":"Operating within baseline"):"Dependency responding normally"}</small></div></header><div className="topology-stage"><div className="topology-canvas"><Canvas dpr={[1,1.5]} camera={{position:[0,0,7.5],fov:37}} gl={{antialias:true,alpha:true,powerPreference:"high-performance"}}><ambientLight intensity={1.35}/><directionalLight position={[3,5,5]} intensity={2.4} color="#dce5f5"/><TopologyGraph status={status} affectedId={affectedId}/></Canvas></div><div className="service-labels">{services.map(item=>{const isAffected=item.id===affectedId;return <button key={item.id} style={{left:`${item.screen[0]}%`,top:`${item.screen[1]}%`}} onClick={()=>setSelected(item.id)} className={cn(selected===item.id&&"selected",isAffected&&incident&&"affected",isAffected&&recovered&&"recovered")}><i/><span><b>{item.label}</b><small>{item.kind}</small></span></button>})}</div></div><footer><span><i className="healthy"/>Healthy dependency</span><span><i className={incident?"affected":"recovered"}/>{incident?"Affected path":"Verified path"}</span><span>Select any service to inspect its state</span></footer></div>;
}
