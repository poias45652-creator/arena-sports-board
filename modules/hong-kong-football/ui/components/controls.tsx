import * as Radix from '@radix-ui/react-tabs';
import { ResponsiveContainer } from 'recharts';
export const Tabs=Radix.Root;
export const TabsContent=Radix.Content;
export function TabsList(props){return <Radix.List {...props} data-slot="tabs-list"/>;}
export function TabsTrigger(props){return <Radix.Trigger {...props} data-slot="tabs-trigger"/>;}
export function ChartContainer({children,className}){return <div className={className}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;}
export function Link(props){return <a {...props}/>;}
