import { featureRegistry } from './registry';import { canAccessFeature } from './permissions';
export function visibleFeatures(input:{pathname:string;signedIn:boolean;role?:string|null;flags?:Record<string,boolean>}){return featureRegistry.filter(feature=>canAccessFeature(feature,{signedIn:input.signedIn,role:input.role,flagEnabled:feature.flag?input.flags?.[feature.flag]??false:true}))}
export function activeFeature(pathname:string){return featureRegistry.find(feature=>feature.match(pathname))??null}
