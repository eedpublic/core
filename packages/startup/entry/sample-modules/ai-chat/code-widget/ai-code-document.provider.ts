import { Injectable } from '@opensumi/di';
import { URI, MaybePromise, Emitter, Event } from '@opensumi/ide-core-browser';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser/index';

@Injectable()
export class AiCodeDocumentProvider implements IEditorDocumentModelContentProvider {
  private _onDidChangeContent = new Emitter<URI>();

  onDidChangeContent: Event<URI> = this._onDidChangeContent.event;

  provideEditorDocumentModelContent(uri: URI, encoding?: string): MaybePromise<string> {
    return '';
  }

  isReadonly(uri: URI): MaybePromise<boolean> {
    return false;
  }

  handlesScheme(scheme: string) {
    return scheme === 'AI';
  }
}
