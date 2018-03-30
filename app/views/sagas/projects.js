import { put, call, takeLatest } from 'redux-saga/effects';
import { ipcRenderer } from 'electron';
import { messgae } from 'antd';
import {
  UPLOAD_NOTE_ONEDRIVER,
  UPLOAD_NOTE_ONEDRIVER_SUCCESS,
  UPLOAD_NOTE_ONEDRIVER_FAILED,
} from '../actions/projects';
import {
  // MARKDOWN_UPLOADING,
  MARKDWON_UPLADING_SUCCESS,
  MARKDWON_UPLADING_FAILED,
} from '../actions/markdown';
import * as db from '../utils/db/app';
import OneDriver from '../services/OneDriver';

const oneDriver = new OneDriver();

function* oneDriverUpload(action) {
  const { param, toolbar } = action;
  const { uuid, name, projectName, projectUuid } = param;
  let content;
  let labels;
  let description;
  try {
    // yield put({ type: MARKDOWN_UPLOADING });
    if (typeof param.content === 'undefined') {
      const data = ipcRenderer.sendSync('read-file', {
        projectName,
        fileName: name,
      });
      if (data.success) {
        content = data.data;
      } else {
        throw new Error('Read file content failed');
      }
    } else {
      content = param.content;
    }
    if (typeof param.labels === 'undefined' || typeof param.description === 'undefined') {
      const note = db.getNote(uuid);
      if (note) {
        labels = note.labels;
        description = note.description;
      } else {
        throw new Error('Can not find note in localStorage.');
      }
    } else {
      labels = param.labels;
      description = param.description;
    }
    const tokens = db.getTokens();
    const { oneDriver: { token, refreshToken, expiresDate } } = tokens;
    let currentToken = token;
    if (Date.parse(new Date()) > expiresDate) { // token过期刷新token
      const refreshData = yield call(oneDriver.refreshToken, refreshToken);
      const newToken = refreshData.access_token;
      const newRefreshToken = refreshData.refresh_token;
      const newExpiresDate = Date.parse(new Date()) + (refreshData.expires_in * 1000);
      currentToken = newToken;
      db.setToken('oneDriver', newToken, newRefreshToken, newExpiresDate);
    }
    // 上传文件
    yield call(oneDriver.uploadSingleFile, currentToken, `/drive/special/approot:/${projectName}/${name}.md:/content`, content);
    // 上传文件信息
    yield call(oneDriver.uploadSingleFile, currentToken, `/drive/special/approot:/${projectName}/${name}.json:/content`, JSON.stringify({
      description,
      labels,
    }));
    yield put({
      type: UPLOAD_NOTE_ONEDRIVER_SUCCESS,
      param: {
        uuid,
        projectUuid,
      },
    });
    if (toolbar) {
      yield put({
        type: MARKDWON_UPLADING_SUCCESS,
      });
    }
  } catch (ex) {
    messgae.error('Upload failed.');
    console.error(ex);
    yield put({
      type: UPLOAD_NOTE_ONEDRIVER_FAILED,
      param: {
        uuid,
        projectUuid,
      },
      error: ex,
    });
    if (toolbar) {
      yield put({
        type: MARKDWON_UPLADING_FAILED,
      });
    }
  }
}

function* noteToOneDriver() {
  yield takeLatest(UPLOAD_NOTE_ONEDRIVER, oneDriverUpload);
}

export default [
  noteToOneDriver,
];
