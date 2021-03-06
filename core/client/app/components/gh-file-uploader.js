import Ember from 'ember';
import { invoke, invokeAction } from 'ember-invoke-action';
import {
    RequestEntityTooLargeError,
    UnsupportedMediaTypeError
} from 'ghost/services/ajax';

const {
    Component,
    computed,
    inject: {service},
    isBlank,
    run
} = Ember;

export default Component.extend({
    tagName: 'section',
    classNames: ['gh-image-uploader'],
    classNameBindings: ['dragClass'],

    labelText: 'Select or drag-and-drop a file',
    url: null,
    paramName: 'file',

    file: null,
    response: null,

    dragClass: null,
    failureMessage: null,
    uploadPercentage: 0,

    ajax: service(),

    formData: computed('file', function () {
        let paramName = this.get('paramName');
        let file = this.get('file');
        let formData = new FormData();

        formData.append(paramName, file);

        return formData;
    }),

    progressStyle: computed('uploadPercentage', function () {
        let percentage = this.get('uploadPercentage');
        let width = '';

        if (percentage > 0) {
            width = `${percentage}%`;
        } else {
            width = '0';
        }

        return Ember.String.htmlSafe(`width: ${width}`);
    }),

    dragOver(event) {
        event.preventDefault();
        this.set('dragClass', '--drag-over');
    },

    dragLeave(event) {
        event.preventDefault();
        this.set('dragClass', null);
    },

    drop(event) {
        event.preventDefault();
        this.set('dragClass', null);
        if (event.dataTransfer.files) {
            invoke(this, 'fileSelected', event.dataTransfer.files);
        }
    },

    generateRequest() {
        let ajax = this.get('ajax');
        let formData = this.get('formData');
        let url = this.get('url');

        invokeAction(this, 'uploadStarted');

        ajax.post(url, {
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'text',
            xhr: () => {
                let xhr = new window.XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    this._uploadProgress(event);
                }, false);

                return xhr;
            }
        }).then((response) => {
            this._uploadSuccess(JSON.parse(response));
        }).catch((error) => {
            this._uploadFailed(error);
        }).finally(() => {
            invokeAction(this, 'uploadFinished');
        });
    },

    _uploadProgress(event) {
        if (event.lengthComputable) {
            run(() => {
                let percentage = Math.round((event.loaded / event.total) * 100);
                this.set('uploadPercentage', percentage);
            });
        }
    },

    _uploadSuccess(response) {
        invokeAction(this, 'uploadSuccess', response);
        invoke(this, 'reset');
    },

    _uploadFailed(error) {
        let message;

        if (error instanceof UnsupportedMediaTypeError) {
            message = 'The file type you uploaded is not supported.';
        } else if (error instanceof RequestEntityTooLargeError) {
            message = 'The file you uploaded was larger than the maximum file size your server allows.';
        } else if (error.errors && !isBlank(error.errors[0].message)) {
            message = error.errors[0].message;
        } else {
            message = 'Something went wrong :(';
        }

        this.set('failureMessage', message);
        invokeAction(this, 'uploadFailed', error);
    },

    actions: {
        fileSelected(fileList) {
            this.set('file', fileList[0]);
            run.schedule('actions', this, function () {
                this.generateRequest();
            });
        },

        reset() {
            this.set('file', null);
            this.set('uploadPercentage', 0);
            this.set('failureMessage', null);
        }
    }
});
