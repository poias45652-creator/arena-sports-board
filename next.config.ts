import type {NextConfig} from "next";
const config: NextConfig = {serverExternalPackages:["pg"],experimental:{cpus:2},poweredByHeader:false,
  async headers(){
    return [{source:'/mt-trial/login',headers:[{key:'Content-Security-Policy',value:"frame-ancestors 'self' https://xingzhun-sports-home.poias45652.chatgpt.site https://chatgpt.com"}]}];
  },
  async rewrites(){
    const paths=['/assets/:file','/api/metrix/:path*','/api/mt/:path*','/api/xingzhun/audit/:path*','/METRIX_dynamic_fullframe_motion_matched_v15_rotating_disk.mp4'];
    return {beforeFiles:paths.map(source=>({source,destination:'/baccarat/resource'+source})),afterFiles:[],fallback:[]};
  }};
export default config;
