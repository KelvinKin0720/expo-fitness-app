import {
    createSlice
} from '@reduxjs/toolkit';

const initialState = {
    userinfo: null
};

const userinfoSlice = createSlice({
    name: 'userinfo',
    initialState,
    reducers: {
        updateUserinfo(state, {
            payload
        }) {
            state.userinfo = payload;
        }
    },
});

export const {
    updateUserinfo
} = userinfoSlice.actions;
export default userinfoSlice.reducer;