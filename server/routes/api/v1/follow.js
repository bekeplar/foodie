const { Types } = require('mongoose');
const { makeResponseJson } = require('../../../helpers/utils');
const { validateObjectID, isAuthenticated } = require('../../../middlewares/middlewares');
const Follow = require('../../../schemas/FollowSchema');
const User = require('../../../schemas/UserSchema');
const Notification = require('../../../schemas/NotificationSchema');

const router = require('express').Router({ mergeParams: true });

router.post(
    '/v1/follow/:follow_id',
    isAuthenticated,
    validateObjectID('follow_id'),
    async (req, res, next) => {
        try {
            const { follow_id } = req.params;

            const user = User.findById(follow_id);
            if (!user) return res.sendStatus(404); // CHECK IF FOLLOWING USER EXIST
            if (follow_id === req.user._id.toString()) return res.sendStatus(400); // CHECK IF FOLLOWING IS NOT YOURSELF

            //  CHECK IF ALREADY FOLLOWING
            const isFollowing = await Follow
                .findOne({
                    _user_id: req.user._id,
                    following: {
                        $in: [Types.ObjectId(follow_id)]
                    }
                });
            if (isFollowing) return res.status(400).send(makeErrorJson({ status_code: 400, message: 'Already following.' }));

            // ADD "FOLLOWERS" FIELD IF NOT EXIST
            // const op1 = await Follow.findOne({ _user_id: req.user._id });
            // if (!op1) {
            //     const follow = new Follow({ _user_id: req.user._id });
            //     await follow.save();
            // }
            // // ADD "FOLLOWING" FIELD IF NOT EXIST
            // const op2 = await Follow.findOne({ _user_id: Types.ObjectId(follow_id) });
            // if (!op2) {
            //     const follow = new Follow({ _user_id: req.user._id });
            //     await follow.save();
            // }

            const bulk = Follow.collection.initializeUnorderedBulkOp();

            bulk.find({ _user_id: req.user._id }).upsert().updateOne({
                $addToSet: {
                    following: Types.ObjectId(follow_id),
                }
            });

            bulk.find({ _user_id: Types.ObjectId(follow_id) }).upsert().updateOne({
                $addToSet: {
                    followers: req.user._id,
                }
            });

            bulk.execute((err, doc) => {
                if (err) {
                    return res.status(200).send(makeResponseJson({ state: false }));
                }

                const io = req.app.get('io');
                const notification = new Notification({
                    type: 'follow',
                    initiator: req.user._id,
                    target: Types.ObjectId(follow_id),
                    link: `/${req.user.username}`,
                    createdAt: Date.now()
                });

                notification
                    .save()
                    .then(async (doc) => {
                        await doc.populate('target initiator', 'fullname profilePicture username').execPopulate();
                        console.log('DOCCCCCCCCCC', doc);
                        io.to(follow_id).emit('notifyFollow', { notification: doc, count: 1 });
                    });

                res.status(200).send(makeResponseJson({ state: true }));
            });
        } catch (e) {
            console.log('CANT FOLLOW USER, ', e);
            res.status(500).send(e);
        }
    }
);

router.post(
    '/v1/unfollow/:follow_id',
    isAuthenticated,
    validateObjectID('follow_id'),
    async (req, res, next) => {
        try {
            const { follow_id } = req.params;

            const user = User.findById(follow_id);
            if (!user) return res.sendStatus(404);
            if (follow_id === req.user._id.toString()) return res.sendStatus(400);

            const bulk = Follow.collection.initializeUnorderedBulkOp();

            bulk.find({ _user_id: req.user._id }).upsert().updateOne({
                $pull: {
                    following: Types.ObjectId(follow_id)
                }
            });

            bulk.find({ _user_id: Types.ObjectId(follow_id) }).upsert().updateOne({
                $pull: {
                    followers: req.user._id
                }
            });

            bulk.execute(function (err, doc) {
                if (err) {
                    return res.status(200).send(makeResponseJson({ state: false }));
                }
                console.log(doc)
                res.status(200).send(makeResponseJson({ state: false }));
            });
        } catch (e) {
            console.log('CANT FOLLOW USER, ', e);
            res.status(500).send(e);
        }
    }
);

router.get(
    '/v1/:username/following',
    isAuthenticated,
    async (req, res) => {
        try {
            const { username } = req.params;

            const user = await User.findOne({ username });
            if (!user) return res.sendStatus(404);

            const doc = await Follow.aggregate([{
                $match: {
                    _user_id: Types.ObjectId(user._id)
                }
            },
            { $unwind: '$following' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'following',
                    foreignField: '_id',
                    as: 'userFollowing'
                }
            },
            { $unwind: '$userFollowing' },
            {
                $group: {
                    _id: '$_id',
                    following: { $push: '$userFollowing' }
                }
            },
            {
                $project: {
                    _user_id: 1,
                    following: 1
                }
            }
            ]);

            res.status(200).send(makeResponseJson(doc));
        } catch (e) {

        }
    });

router.get(
    '/v1/:username/followers',
    isAuthenticated,
    async (req, res) => {
        try {
            const { username } = req.params;

            const user = await User.findOne({ username });
            if (!user) return res.sendStatus(404);

            const doc = await Follow.aggregate([{
                $match: {
                    _user_id: Types.ObjectId(user._id)
                }
            },
            { $unwind: '$followers' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'followers',
                    foreignField: '_id',
                    as: 'userFollowers'
                }
            },
            { $unwind: '$userFollowers' },
            {
                $group: {
                    _id: '$_id',
                    followers: { $push: '$userFollowers' }
                }
            },
            {
                $project: {
                    _user_id: 1,
                    followers: 1
                }
            }
            ]);

            res.status(200).send(makeResponseJson(doc))
        } catch (e) {

        }
    });

module.exports = router;