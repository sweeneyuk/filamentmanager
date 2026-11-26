import { Download } from 'lucide-react';
import Dialog from '../../ui/Dialog';

export default function MediaViewer({ media, onClose }) {
  return (
    <Dialog
      open={Boolean(media)}
      title={media ? `${media.kind === 'video' ? 'Timelapse' : 'Photo'} of ${media.name}` : ''}
      onClose={onClose}
      size="lg"
      footer={media && (
        <a className="ui-btn ui-btn--outline" href={media.src} download>
          <Download size={18} aria-hidden="true" /><span className="ui-btn__text">Download</span>
        </a>
      )}
    >
      {media?.kind === 'video' && (
        <video className="hi-media" src={media.src} controls autoPlay playsInline />
      )}
      {media?.kind === 'photo' && <img className="hi-media" src={media.src} alt={`Photo of ${media.name}`} />}
    </Dialog>
  );
}
