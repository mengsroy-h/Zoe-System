/**
 * វីដេអូកាមេរ៉ា ៖ attribute ដែល iOS ត្រូវការ **ពេល stream ចាប់ផ្តើម**
 * (`playsinline` · `webkit-playsinline`) — ធាតុជារបស់ React; ការដាក់ stream
 * ជា «media playback» ដែល React ណែនាំឲ្យធ្វើតាម ref។
 */
export function prepareInlineVideo(video: HTMLVideoElement, withWebkit: boolean): void {
    video.setAttribute('playsinline', 'true');
    if (withWebkit) video.setAttribute('webkit-playsinline', 'true');
}
