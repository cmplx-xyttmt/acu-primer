<script lang="ts">
  // Confirm a delete (Oct 24): says what goes with it, and the Delete button only wakes up once
  // the author has typed the exact title, so nothing goes by a slip of the mouse.
  import Trash2 from "@lucide/svelte/icons/trash-2";

  let {
    kind,
    title,
    takes,
    onConfirm,
    onClose,
  }: {
    kind: "subject" | "chapter" | "lesson";
    title: string;
    takes: string; // what else goes, in plain words
    onConfirm: (typed: string) => Promise<void>;
    onClose: () => void;
  } = $props();

  let typed = $state("");
  let busy = $state(false);
  let error = $state("");
  let dialog = $state<HTMLDialogElement>();
  const matches = $derived(typed.trim() === title.trim());

  $effect(() => {
    dialog?.showModal();
  });

  async function confirm() {
    if (!matches) return;
    busy = true;
    error = "";
    try {
      await onConfirm(typed);
    } catch (err) {
      error = err instanceof Error ? err.message : "Something went wrong.";
      busy = false;
    }
  }
</script>

<dialog bind:this={dialog} onclose={onClose} aria-labelledby="delete-title">
  <h2 id="delete-title">Delete this {kind}?</h2>
  <p><strong>{title}</strong></p>
  <p>This also deletes {takes}. It can't be undone.</p>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      confirm();
    }}
  >
    <label>
      Type the {kind}'s title to confirm
      <!-- svelte-ignore a11y_autofocus (the dialog was opened for this) -->
      <input type="text" bind:value={typed} autocomplete="off" spellcheck="false" autofocus />
    </label>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="row">
      <button class="btn btn-danger" type="submit" disabled={!matches || busy}><Trash2 size={16} aria-hidden="true" />{busy ? "Deleting…" : `Delete ${kind}`}</button>
      <button class="btn-quiet" type="button" onclick={() => dialog?.close()}>Cancel</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(30rem, calc(100vw - 32px));
    padding: 1.2rem 1.3rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  h2 {
    margin: 0 0 0.6rem;
    font-size: 1.2rem;
  }
  p {
    margin: 0 0 0.6rem;
    overflow-wrap: anywhere;
  }
  form {
    display: grid;
    gap: 0.8rem;
    margin-top: 0.6rem;
  }
  label {
    display: grid;
    gap: 0.35rem;
    font-weight: 600;
    font-size: 0.92rem;
  }
  .row {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .error {
    color: var(--wrong);
  }
</style>
