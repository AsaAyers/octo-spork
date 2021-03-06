import test from 'tape'
import { wrapSelector, loaderMiddleware } from './index.js'
import { createStore, applyMiddleware } from 'redux'
import promiseMiddleware from 'redux-promise'

import { notPromise, promiseValue, notActions, writeFail } from './index.js'

const CREATE_TODO = 'CREATE_TODO'
const BATCH_TODO = 'BATCH_TODO'

function reducer(state = { todos: {} }, action) {
    if (action.type === CREATE_TODO) {
        const { id, description, done } = action.payload
        const todos = {
            ...state.todos,
            [id]: { description, done },
        }
        return { ...state, todos }
    }
    if (action.type === BATCH_TODO) {
        // payload is an array of data, just convert it to individual actions
        const actions = action.payload.map((data) => ({
            type: CREATE_TODO,
            payload: data
        }))

        return actions.reduce(reducer, state)
    }
    return state
}


const selectTodo = (id) => (state) => state.todos[id]

const createTodo = (id, description) => {
    return {
        type: CREATE_TODO,
        payload: { id, description, done: false }
    }
}

const batchTodo = (items = []) => {
    return {
        type: BATCH_TODO,
        payload: items
    }
}

function configureStore() {
    return applyMiddleware(
        loaderMiddleware,
        promiseMiddleware
    )(createStore)(reducer)
}

function fetchTodo(id) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({id, description: `TODO: ${id}`})
        }, 10)
    })
}

function fetchTodos(ids) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = ids.map(id => ({
                id,
                description: `TODO: ${id}`
            }))
            resolve(data)
        }, 10)
    })
}

test('basic wrapSelector (1 item)', assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        const data = Promise.all(keys.map(fetchTodo))

        return data.then((items) => {
            return items.map(({id, description}) => {
                return createTodo(id, description)
            })
        })
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    }).catch(( {message} ) => assert.fail(message) )
})

test('basic wrapSelector (2 items)', assert => {
    assert.plan(3)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        assert.deepEqual(keys, [ 1, 2 ])
        const data = Promise.all(keys.map(fetchTodo))

        return data.then((items) => {
            return items.map(({id, description}) => {
                return createTodo(id, description)
            })
        })
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    })

    store.dispatch(requireTodo(2)).then((result) => {
        assert.equal(result.description, 'TODO: 2')
    })
})

test("batch insert", assert => {
    assert.plan(3)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        assert.deepEqual(keys, [ 1, 2 ])
        return fetchTodos(keys).then((data) => batchTodo(data))
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    })

    store.dispatch(requireTodo(2)).then((result) => {
        assert.equal(result.description, 'TODO: 2')
    })
})

test("works when API request isn't needed", assert => {
    assert.plan(1)
    const store = configureStore()
    store.dispatch(createTodo(1, 'TODO: 1'))

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        // There is no need to call this when everything exists in the store.
        assert.fail()
    })

    store.dispatch(requireTodo(1)).then((result) => {
        assert.equal(result.description, 'TODO: 1')
    })
})

test("Only calls the API for missing keys", assert => {
    assert.plan(1)
    const store = configureStore()
    store.dispatch(createTodo(1, 'TODO: 1'))

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        assert.deepEqual(keys, [ 2 ])
        const data = Promise.all(keys.map(fetchTodo))

        return data.then((items) => {
            return items.map(({id, description}) => {
                return createTodo(id, description)
            })
        })
    })

    store.dispatch(requireTodo(1))
    store.dispatch(requireTodo(2))
})

test("same promise", assert => {
    assert.plan(3)
    const store = configureStore()

    let called = 0
    const requireTodo = wrapSelector(selectTodo, (keys) => {
        called++
        assert.deepEqual(keys, [ 1 ])
        const data = Promise.all(keys.map(fetchTodo))

        return data.then((items) => {
            return items.map(({id, description}) => {
                return createTodo(id, description)
            })
        })
    })

    const p1 = store.dispatch(requireTodo(1))
    const p2 = store.dispatch(requireTodo(1))

    assert.equal(p1, p2, 'same promise?')

    Promise.all([p1, p2]).then(() => {
        assert.equal(called, 1)
    })

})

test("error: reducer didn't write", assert => {
    assert.plan(1)
    const store = configureStore()

    const requireTodo = wrapSelector(selectTodo, (keys) => {
        return Promise.all(keys.map((k) => ({
            type: 'WRONG_TYPE',
            payload: {}
        })))
    })

    store.dispatch(requireTodo(1)).catch((err) => {
        assert.equal(err.message, writeFail)
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
        assert.equal(err.message, promiseValue)
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
