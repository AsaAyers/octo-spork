octo-spork
==========

I don't know what to call this thing yet, but I want to make it public so I can gather feedback.


Core concept
------------

The selector pulls data from your local store. If the selector doesn't find any data, this makes a request to the API. Then it generates an action to update the store, so that when the selector runs again it will find the data.

I built this on top of [facebook/dataloader](https://github.com/facebook/dataloader) so it would batch the keys.

```js
const requireTodo = wrapSelector(selectTodo, function loader(keys) {
    // fetchTodos is however you talk to your API.
    return api.fetchTodos(keys).then((todos) => {
        // createTodo is an ordinary Action Creator
        todos.map(createTodo)
    })
})

// These will get batched so above you receive `keys = [1, 2]`
requireTodo(1)
requireTodo(2)
```

TODO
----

* Figure out how error handling should work
* Try out integrating this with [graphql-js](https://github.com/graphql/graphql-js)
