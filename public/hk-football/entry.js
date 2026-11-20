import {mountDeep} from './inner.js';
if(!mountDeep()) await import('./app.js');
