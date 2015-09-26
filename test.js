import test from 'tape'
import { wrapSelector, loaderMiddleware } from './index.js'
import { createStore, applyMiddleware } from 'redux'
import promiseMiddleware from 'redux-promise'

import { notPromise, notArray, notActions } from './index.js'

function reducer(state = { todos: {} }, action) {
    if (action.type === CREATE_TODO) {
        const { id, description, done } = action.payload
        const todos = {
            ...state.todos,
            [id]: { description, done },
        }
        return { ...state, todos }
    }
    return state
}

const CREATE_TODO = 'CREATE_TODO'

const selectTodo = (id) => (state) => state.todos[id]

const createTodo = (id, description) => ({
    type: CREATE_TODO,
    payload: { id, description, done: false }
})

function configureStore() {
    return applyMiddleware(
        loaderMiddleware,
        promiseMiddleware
    )(createStore)(reducer)
}

function fetchTodo(id) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(createTodo(id, `TODO: ${id}`))
        }, 10)
    })
}

test('basic wrapSelector (1 item)', assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        return Promise.all(keys.map(fetchTodo))
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    }).catch(( {message} ) => assert.fail(message) )
})

test('basic wrapSelector (2 items)', assert => {
    assert.plan(3)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        assert.equal(keys.length, 2, 'loader should batch requests')
        return Promise.all(keys.map(fetchTodo))
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    })

    store.dispatch(requireTodo(2)).then((result) => {
        assert.equal(result.description, 'TODO: 2')
    })
})


test("error: Not promise", assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        return {}
    })

    store.dispatch(requireTodo(1)).catch((err) => {
        assert.equal(err.message, notPromise)
    })
})

test("error: Not actions", assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        return Promise.resolve({})
    })

    store.dispatch(requireTodo(1)).catch((err) => {
        assert.equal(err.message, notArray)
    })
})


test("error: Not actions", assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        return Promise.resolve(keys)
    })

    store.dispatch(requireTodo(1)).catch((err) => {
        assert.equal(err.message, notActions)
    })
})
