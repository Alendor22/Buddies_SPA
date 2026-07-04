import Link from 'next/link';

export default async function NewDogPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies V2.2 Add Dog One-Tap Fix</p>
          <h1 className="mt-1 text-3xl font-bold">Add dog</h1>
          <p className="mt-2 text-slate-600">Create a public safety profile with identifying details, health notes, and emergency contact information.</p>
        </div>
        <Link href="/dashboard" className="rounded-lg border px-4 py-2">Cancel</Link>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">The form could not be submitted. Try again.</div>
      ) : null}

      <form action="/dogs/new/confirm" method="get" className="mt-8 grid gap-6 rounded-2xl border bg-white p-6 shadow-sm">
        <section>
          <h2 className="text-xl font-semibold">Core profile</h2>
          <p className="mt-1 text-sm text-slate-500">Name is optional during mobile testing. Blank names are saved as New Buddy.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">Name<input name="name" maxLength={80} placeholder="New Buddy" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Breed<input name="breed" maxLength={120} className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Birth date<input name="birthDate" type="date" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Weight lb<input name="weightLbs" type="number" min="1" max="300" className="rounded-lg border px-3 py-3 text-base" /></label>
            <label className="grid gap-2 text-sm font-medium">Gender<select name="gender" className="rounded-lg border px-3 py-3 text-base"><option value="">Not specified</option><option value="Female">Female</option><option value="Male">Male</option></select></label>
            <label className="grid gap-2 text-sm font-medium">Safety status<select name="status" defaultValue="SAFE" className="rounded-lg border px-3 py-3 text-base"><option value="SAFE">Safe</option><option value="LOST">Lost</option><option value="FOUND">Found</option></select></label>
          </div>
        </section>

        <label className="grid gap-2 text-sm font-medium">Photo URL<input name="photoUrl" type="url" placeholder="https://..." className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Temperament<textarea name="temperament" rows={3} maxLength={500} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Vaccination notes<textarea name="vaccinationNotes" rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Medical notes<textarea name="medicalNotes" rows={3} maxLength={800} className="rounded-lg border px-3 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-medium">Emergency contact<input name="emergencyContact" maxLength={160} className="rounded-lg border px-3 py-3 text-base" /></label>

        <fieldset className="grid gap-3 rounded-xl border p-4">
          <legend className="px-2 text-sm font-semibold">Compatibility</legend>
          <label className="flex items-center gap-3"><input name="spayedNeutered" type="checkbox" /> Spayed or neutered</label>
          <label className="flex items-center gap-3"><input name="friendlyDogs" type="checkbox" defaultChecked /> Friendly with dogs</label>
          <label className="flex items-center gap-3"><input name="friendlyCats" type="checkbox" /> Friendly with cats</label>
          <label className="flex items-center gap-3"><input name="friendlyChildren" type="checkbox" defaultChecked /> Friendly with children</label>
        </fieldset>

        <button type="submit" formNoValidate className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Create dog profile</button>
      </form>
    </main>
  );
}
