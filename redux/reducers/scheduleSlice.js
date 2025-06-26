import { createSlice } from '@reduxjs/toolkit';

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState: {
    schedules: [
      {
        id: 1,
        day: "Monday",
        workouts: [],
      },
      {
        id: 2,
        day: "Tuesday",
        workouts: [],
      },
      {
        id: 3,
        day: "Wednesday",
        workouts: [],
      },
      {
        id: 4,
        day: "Thursday",
        workouts: [],
      },
      {
        id: 5,
        day: "Friday",
        workouts: [],
      },
      {
        id: 6,
        day: "Saturday",
        workouts: [],
      },
      {
        id: 7,
        day: "Sunday",
        workouts: [],
      },
    ],
  },
  reducers: {
    updateSchedules: (state, action) => {
      state.schedules = action.payload;
    },
  },
});

export const { updateSchedules } = scheduleSlice.actions;
export default scheduleSlice.reducer; 