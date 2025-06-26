import { createSlice } from '@reduxjs/toolkit';

const workoutsSlice = createSlice({
  name: 'workouts',
  initialState: {
    workouts: [],
  },
  reducers: {
    updateWorkouts: (state, action) => {
      state.workouts = action.payload;
    },
    addWorkout: (state, action) => {
      state.workouts.unshift(action.payload); 
    },
  },
});

export const { updateWorkouts, addWorkout } = workoutsSlice.actions;
export default workoutsSlice.reducer; 