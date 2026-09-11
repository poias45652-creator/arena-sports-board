import type {NextConfig} from "next";
const config:NextConfig={output:"standalone",outputFileTracingRoot:process.cwd(),experimental:{cpus:2}};
export default config;
