# mongoose-power-populate

> Recursively populate mongoose document references in either direction.

Mongoose's populate not enough for you?

## Usage

Wrap `mongoose` to provide the new `populate()` method:

```javascript
var mongoose = require('mongoose');
require('mongoose-power-populate')(mongoose);
```

Populate `book.author` given a `Book` model with a `authorId` field containing
the id of a `User` model:

```javascript
Book
  .find(...)
  .populate('author', {
    author: {
      ref: 'User',
      foreignKey: 'authorId',
      singular: true // populate with one document instead of array
    }
  })
  .exec(...);
```

Populate multiple paths:

```javascript
Post
  .find(...)
  .populate('comments author')
  .exec(...);
```

Populate (infinitely) nested paths:

```javascript
User
  .find(...)
  .populate('posts.comments', {
    'posts': { /* posts options */ },
    'posts.comments': { /* comments options */ }
  })
  .exec(...);
```

Provide default populate options using the schema plugin:

```javascript
var mongoose = require('mongoose');
var populate = require('mongoose-power-populate')(mongoose);

var UserSchema = new mongoose.Schema(...);
var BookSchema = new mongoose.Schema(...);

BookSchema.plugin(populate, {
  author: {
    ref: 'User',
    foreignKey: 'authorId',
    singular: true
  }
});

var User = mongoose.model('User', UserSchema);
var Book = mongoose.model('Book', BookSchema);

Book
  .find()
  .populate('author')
  .exec(...);
```

Reverse populate (where the foreign key is on the nested document):

```javascript
var PostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  body: {
    type: String
  }
});

var CommentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  comment: {
    type: String
  }
});

Post
  .find(...)
  .populate('comments', {
    comments: {
      ref: 'Comment',
      foreignKey: 'postId'
    }
  })
  .exec(...);
```

Populate existing documents:

```javascript
Post.populate(docs, 'comments', callback);
```
