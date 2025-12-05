// Upload client for obtaining presigned S3 URLs and uploading files directly.
// Designed to be small and framework-agnostic. Token can be provided as a string
// or an async function that returns a token (to integrate with Amplify/AuthContext).
/* eslint-disable no-console */

const DEFAULT_API = process.env.NEXT_PUBLIC_UPLOAD_API || '';

async function resolveToken(tokenOrGetter) {
	if (!tokenOrGetter) return null;
	if (typeof tokenOrGetter === 'string') return tokenOrGetter;
	if (typeof tokenOrGetter === 'function') {
		return await tokenOrGetter();
	}
	return null;
}

/**
 * Request a presigned upload URL from the backend.
 *
 * @param {string|function():Promise<string>} idTokenOrGetter - Cognito ID token string or async getter that returns it
 * @param {Object} params
 * @param {string} params.fileName
 * @param {number} params.fileSize
 * @param {string} [params.title]
 * @param {string} [params.author]
 * @param {string} [params.description]
 * @param {string} [apiUrl] - override API endpoint
 * @returns {Promise<{uploadUrl:string, bookId:string, expiresIn:number}>}
 */
export async function getUploadUrl(idTokenOrGetter, params = {}, apiUrl) {
	const token = await resolveToken(idTokenOrGetter);
	const url = apiUrl || DEFAULT_API;
	if (!url) throw new Error('Upload API URL not configured (NEXT_PUBLIC_UPLOAD_API)');

	const body = {
		fileName: params.fileName,
		fileSize: params.fileSize,
		title: params.title || params.fileName,
		author: params.author || '',
		description: params.description || '',
	};
	const headers = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		const err = new Error(`getUploadUrl failed: ${res.status} ${text}`);
		err.status = res.status;
		throw err;
	}

	return res.json();
}

/**
 * Upload a file to S3 using a presigned URL.
 * Important: do NOT set the Content-Type header when using the presigned PUT URL
 * if the backend generated the signature without content-type (infra note).
 *
 * @param {string} uploadUrl
 * @param {Blob|File|ArrayBuffer|Uint8Array} file
 * @param {Object} [options]
 * @param {function(number,number):void} [options.onProgress] - progress callback (only available if browser supports upload progress via XHR)
 * @returns {Promise<void>}
 */
export async function uploadToS3(uploadUrl, file, options = {}) {
	// If caller provided onProgress, use XHR to report progress; otherwise use fetch.
	if (options.onProgress && typeof window !== 'undefined' && window.XMLHttpRequest) {
		return new Promise((resolve, reject) => {
			try {
				// Convert to Blob without type to prevent browser from auto-setting Content-Type
				const fileBlob = file instanceof Blob ? new Blob([file], { type: '' }) : file;
				
				const xhr = new XMLHttpRequest();
				xhr.open('PUT', uploadUrl, true);
				// CRITICAL: Do NOT set Content-Type header to avoid signature mismatch
				// Backend presigned URL does not include Content-Type in signature

				xhr.upload.onprogress = (e) => {
					if (!e.lengthComputable) return;
					options.onProgress(e.loaded, e.total);
				};
				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) return resolve();
					const error = new Error(`S3 upload failed: ${xhr.status} ${xhr.statusText}`);
					error.status = xhr.status;
					error.response = xhr.responseText;
					console.error('XHR upload failed:', { status: xhr.status, statusText: xhr.statusText, response: xhr.responseText });
					return reject(error);
				};
				xhr.onerror = (e) => {
					console.error('XHR network error event:', e);
					console.error('XHR details:', { readyState: xhr.readyState, status: xhr.status, statusText: xhr.statusText });
					reject(new Error('S3 upload network error - likely CORS or network issue. Check browser console for details.'));
				};
				xhr.ontimeout = () => {
					console.error('XHR timeout');
					reject(new Error('S3 upload timeout'));
				};
				xhr.send(fileBlob);
			} catch (err) {
				reject(err);
			}
		});
	}

	// simple fetch-based upload
	// IMPORTANT: Convert to Blob without type to prevent browser from auto-setting Content-Type
	const fileBlob = file instanceof Blob ? new Blob([file], { type: '' }) : file;
	
	const res = await fetch(uploadUrl, {
		method: 'PUT',
		// Explicitly set empty headers to prevent Content-Type
		headers: {},
		body: fileBlob,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		const err = new Error(`S3 upload failed: ${res.status} ${text}`);
		err.status = res.status;
		throw err;
	}
	return;
}

/**
 * Optional: notify backend that upload completed (if you have such endpoint).
 * Example: POST /books/{bookId}/complete
 *
 * @param {string|function():Promise<string>} idTokenOrGetter
 * @param {string} bookId
 * @param {string} [apiBase] - base url like https://.../books
 */
export async function notifyUploadComplete(idTokenOrGetter, bookId, apiBase) {
	if (!bookId) throw new Error('bookId required');
	const token = await resolveToken(idTokenOrGetter);
	if (!apiBase && process.env.NEXT_PUBLIC_UPLOAD_API) {
		// derive base by removing path after /books in the default API
		const m = process.env.NEXT_PUBLIC_UPLOAD_API.match(/^(https?:\/\/[^/]+)\/(.*)$/);
		apiBase = m ? `${m[1]}/books` : process.env.NEXT_PUBLIC_UPLOAD_API;
	}
	if (!apiBase) {
		// best-effort default: same API host used for creating upload URL
		apiBase = DEFAULT_API.replace(/\/upload-url$/, '');
	}
	const url = `${apiBase.replace(/\/$/, '')}/${encodeURIComponent(bookId)}/complete`;
	const headers = { 'Content-Type': 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(url, { method: 'POST', headers });
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`notifyUploadComplete failed: ${res.status} ${text}`);
	}
	return await res.json().catch(() => null);
}

/**
 * Helper for apps using AWS Amplify Auth to get ID token.
 * Returns an async function you can pass as the idTokenOrGetter to other helpers.
 * Usage: const getToken = getAmplifyIdTokenGetter(); await getUploadUrl(getToken, ...)
 */
export function getAmplifyIdTokenGetter() {
	return async function amplifyGetToken() {
		try {
			// dynamic import to avoid hard dependency at build time
			// eslint-disable-next-line import/no-extraneous-dependencies
			const { Auth } = await import('aws-amplify');
			const session = await Auth.currentSession();
			return session.getIdToken().getJwtToken();
		} catch (err) {
			console.warn('Amplify Auth not available or failed to get session', err);
			return null;
		}
	};
}

export default {
	getUploadUrl,
	uploadToS3,
	notifyUploadComplete,
	getAmplifyIdTokenGetter,
};
