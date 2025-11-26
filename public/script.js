async function uploadFile() {
    const file = document.getElementById('fileInput').files[0];
    if (!file) return alert("Select a file!");

    const formData = new FormData();
    formData.append('secretFile', file);

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.innerText = "Uploading...";

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        document.getElementById('result').classList.remove('hidden');
        document.getElementById('linkOutput').value = data.url;
        document.getElementById('passOutput').value = data.password;
    } catch(e) {
        alert("Upload failed");
    } finally {
        btn.disabled = false;
        btn.innerText = "Generate Link";
    }
}

function copyToClip(id) {
    const el = document.getElementById(id);
    el.select();
    document.execCommand("copy");
}
