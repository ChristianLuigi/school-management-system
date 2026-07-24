import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";
export async function PUT(request:NextRequest,{params}:{params:Promise<{userId:string}>}){const {userId}=await params;return proxyAuthenticated(request,{method:"PUT",path:`/access-management/finance/${encodeURIComponent(userId)}/permissions`});}