export type FeatureEvent={featureId:string;action:'opened'|'started'|'succeeded'|'failed'|'permission_denied';requestId?:string;durationMs?:number;metadata?:Record<string,string|number|boolean|null>};
export function emitFeatureEvent(event:FeatureEvent){console.info(JSON.stringify({type:'feature_event',at:new Date().toISOString(),...event}))}
