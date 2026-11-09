import type {NextConfig} from "next";
const config: NextConfig = {serverExternalPackages:["pg"],experimental:{cpus:2},poweredByHeader:false,
  async rewrites(){
    const paths=['/assets/:file','/api/metrix/:path*','/api/mt/:path*','/api/xingzhun/audit/:path*','/METRIX_dynamic_fullframe_motion_matched_v15_rotating_disk.mp4'];
    return {beforeFiles:paths.map(source=>({source,destination:'/baccarat/resource'+source})),afterFiles:[],fallback:[]};
  }};
export default config;
