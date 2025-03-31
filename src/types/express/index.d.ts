import * as express from 'express';
import { IUserDocument } from '../../models/User';

declare global {
  namespace Express {
    // extend Request object
    interface User extends IUserDocument {}
  }
}

export = express; 