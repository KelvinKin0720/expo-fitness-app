import { combineReducers } from '@reduxjs/toolkit';
import userinfoReducer from './userinfoSlice';
import scheduleReducer from './scheduleSlice';
import workoutsReducer from './workoutsSlice';

const rootReducer = combineReducers({
  userinfo: userinfoReducer,
  schedule: scheduleReducer,
  workouts: workoutsReducer,
});

export default rootReducer;