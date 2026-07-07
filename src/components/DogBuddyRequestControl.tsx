'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';

type DogOption = {
  id: string;
  name: string;
};

type PairState = {
  direction: 'OUTGOING' | 'INCOMING';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  requestId: string;
};

type Props = {
  receiverDog: DogOption;
  senderDogs: DogOption[];
  initialStates: Record<string, PairState | undefined>;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  request?: {
    id: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
    senderDogId: string;
    senderDogName: string;
    receiverDogId: string;
    receiverDogName: string;
  };
};

const REQUEST_TIMEOUT_MS = 15000;

export default function DogBuddyRequestControl({ receiverDog, senderDogs, initialStates }: Props) {
  const [senderDogId, setSenderDogId] = useState(senderDogs[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [states, setStates] = useState(initialStates);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const requestSequence = useRef(0);

  const selectedSender = useMemo(
    () => senderDogs.find((dog) => dog.id === senderDogId) ?? senderDogs[0],
    [senderDogId, senderDogs]
  );
  const pairState = senderDogId ? states[senderDogId] : undefined;

  const buttonLabel = useMemo(() => {
    if (pending) return `Sending ${selectedSender?.name ?? 'dog'} → ${receiverDog.name}…`;
    if (pairState?.direction === 'OUTGOING' && pairState.status === 'PENDING') {
      return `Request sent · ${selectedSender?.name ?? 'Dog'} → ${receiverDog.name}`;
    }
    if (pairState?.direction === 'INCOMING' && pairState.status === 'PENDING') {
      return `Request received · ${receiverDog.name} → ${selectedSender?.name ?? 'Dog'}`;
    }
    if (pairState?.status === 'ACCEPTED') {
      return `${selectedSender?.name ?? 'Dog'} and ${receiverDog.name} are buddies`;
    }
    if (pairState?.status === 'DECLINED' || pairState?.status === 'CANCELLED') {
      return `Send again · ${selectedSender?.name ?? 'Dog'} → ${receiverDog.name}`;
    }
    return `Send request · ${selectedSender?.name ?? 'Dog'} → ${receiverDog.name}`;
  }, [pairState, pending, receiverDog.name, selectedSender?.name]);

  const disabled = pending
    || !senderDogId
    || pairState?.status === 'PENDING'
    || pairState?.status === 'ACCEPTED';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !selectedSender) return;

    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    const previousState = states[selectedSender.id];
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    setPending(true);
    setFeedback(`Sending ${selectedSender.name}'s request to ${receiverDog.name}…`);

    try {
      const formData = new FormData();
      formData.set('senderDogId', selectedSender.id);
      formData.set('receiverDogId', receiverDog.id);
      formData.set('note', note);

      const response = await fetch('/api/buddies/request', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'x-buddies-response': 'json'
        },
        body: formData,
        signal: controller.signal,
        cache: 'no-store'
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('The request service returned an unexpected response. Reload this page and try again.');
      }

      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error || 'Buddy request could not be sent.');
      }

      if (requestSequence.current !== sequence) return;

      setStates((current) => ({
        ...current,
        [selectedSender.id]: {
          direction: 'OUTGOING',
          status: payload.request!.status,
          requestId: payload.request!.id
        }
      }));
      setNote('');
      setFeedback(`Request sent: ${selectedSender.name} → ${receiverDog.name}.`);
    } catch (error) {
      if (requestSequence.current !== sequence) return;

      setStates((current) => ({ ...current, [selectedSender.id]: previousState }));
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Request timed out after 15 seconds. Tap the button to retry.'
        : error instanceof Error
          ? error.message
          : 'Buddy request could not be sent.';
      setFeedback(message);
    } finally {
      window.clearTimeout(timeout);
      if (requestSequence.current === sequence) setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2">
      <label className="sr-only" htmlFor={`sender-${receiverDog.id}`}>Select requesting dog</label>
      <select
        id={`sender-${receiverDog.id}`}
        value={senderDogId}
        onChange={(event) => {
          setSenderDogId(event.target.value);
          setFeedback('');
        }}
        required
        className="rounded-lg border px-3 py-2 text-sm"
      >
        {senderDogs.map((dog) => (
          <option key={dog.id} value={dog.id}>{dog.name} requests {receiverDog.name}</option>
        ))}
      </select>

      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional dog-to-dog note"
        maxLength={500}
        disabled={Boolean(pairState?.status === 'PENDING' || pairState?.status === 'ACCEPTED')}
        className="rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
      />

      <button
        type="submit"
        disabled={disabled}
        className={`rounded-lg px-4 py-3 text-sm font-semibold ${
          pairState?.status === 'PENDING' || pairState?.status === 'ACCEPTED'
            ? 'border bg-slate-100 text-slate-700'
            : 'bg-slate-900 text-white'
        } disabled:cursor-not-allowed disabled:opacity-100`}
      >
        {buttonLabel}
      </button>

      {feedback ? <p className="text-xs font-medium text-slate-600" role="status" aria-live="polite">{feedback}</p> : null}
    </form>
  );
}
