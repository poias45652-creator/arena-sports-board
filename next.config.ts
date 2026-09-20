import type {NextConfig} from "next";
const config: NextConfig = {serverExternalPackages:["pg"],experimental:{cpus:2},poweredByHeader:false};
export default config;
