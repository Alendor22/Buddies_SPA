import Ably from 'ably';

let restClient: Ably.Rest | null = null;

function getRestClient() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return null;
  restClient ??= new Ably.Rest(apiKey);
  return restClient;
}

export async function publishRealtime(channelName: string, eventName: string, data: unknown) {
  const client = getRestClient();
  if (!client) return false;

  try {
    await client.channels.get(channelName).publish(eventName, data);
    return true;
  } catch (error) {
    console.error('Realtime publish failed', { channelName, eventName, error });
    return false;
  }
}
